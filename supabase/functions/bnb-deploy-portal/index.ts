import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SaturnPortal Solidity Source — compiled on-the-fly
// ============================================================================
const SATURN_PORTAL_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SaturnToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address _recipient, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "ERC20: insufficient balance");
        unchecked { balanceOf[msg.sender] -= _value; balanceOf[_to] += _value; }
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(balanceOf[_from] >= _value, "ERC20: insufficient balance");
        require(allowance[_from][msg.sender] >= _value, "ERC20: insufficient allowance");
        unchecked { allowance[_from][msg.sender] -= _value; balanceOf[_from] -= _value; balanceOf[_to] += _value; }
        emit Transfer(_from, _to, _value);
        return true;
    }
}

contract SaturnPortal {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant BONDING_TOKENS = 800_000_000 * 1e18;
    uint256 public constant LP_TOKENS = 200_000_000 * 1e18;
    uint256 public constant VIRTUAL_BNB = 6_140_000_000_000_000_000;
    uint256 public constant VIRTUAL_TOKENS = 107_036_752 * 1e18;
    uint256 public constant GRADUATION_THRESHOLD = 16 ether;
    uint256 public constant TRADING_FEE_BPS = 100;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public owner;
    address public platformWallet;

    struct TokenInfo {
        address creator;
        uint256 creatorFeeBps;
        uint256 virtualBnb;
        uint256 virtualTokens;
        uint256 realBnb;
        uint256 realTokens;
        uint256 totalFeesCollected;
        uint256 creatorFeesClaimed;
        bool graduated;
        string metadataUri;
    }

    mapping(address => TokenInfo) public tokens;
    address[] public allTokens;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 creatorFeeBps, string metadataUri);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 bnbAmount, uint256 tokenAmount, uint256 fee, uint256 newPrice, uint256 realBnbReserves, uint256 bondingProgress);
    event Graduated(address indexed token, address indexed v3Pool, uint256 bnbLiquidity, uint256 tokenLiquidity);
    event FeesClaimed(address indexed token, address indexed creator, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _platformWallet) {
        owner = msg.sender;
        platformWallet = _platformWallet;
    }

    function newToken(string calldata _name, string calldata _symbol, uint256 _creatorFeeBps, string calldata _metadataUri, bytes32 _salt) external payable returns (address tokenAddress) {
        require(_creatorFeeBps <= BPS_DENOMINATOR, "Fee > 100%");
        bytes memory bytecode = abi.encodePacked(type(TunaToken).creationCode, abi.encode(_name, _symbol, address(this), TOTAL_SUPPLY));
        assembly { tokenAddress := create2(0, add(bytecode, 0x20), mload(bytecode), _salt) if iszero(tokenAddress) { revert(0, 0) } }
        tokens[tokenAddress] = TokenInfo({ creator: msg.sender, creatorFeeBps: _creatorFeeBps, virtualBnb: VIRTUAL_BNB, virtualTokens: VIRTUAL_TOKENS, realBnb: 0, realTokens: BONDING_TOKENS, totalFeesCollected: 0, creatorFeesClaimed: 0, graduated: false, metadataUri: _metadataUri });
        allTokens.push(tokenAddress);
        emit TokenCreated(tokenAddress, msg.sender, _name, _symbol, _creatorFeeBps, _metadataUri);
        if (msg.value > 0) { _buy(tokenAddress, msg.sender); }
        return tokenAddress;
    }

    function buy(address _token) external payable { _buy(_token, msg.sender); }

    function _buy(address _token, address _recipient) internal {
        TokenInfo storage info = tokens[_token];
        require(info.creator != address(0), "Token not found");
        require(!info.graduated, "Graduated");
        require(msg.value > 0, "No BNB");
        uint256 fee = (msg.value * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 bnbIn = msg.value - fee;
        uint256 effectiveBnb = info.virtualBnb + info.realBnb;
        uint256 effectiveTokens = info.virtualTokens + info.realTokens;
        uint256 k = effectiveBnb * effectiveTokens;
        uint256 newEffectiveBnb = effectiveBnb + bnbIn;
        uint256 newEffectiveTokens = k / newEffectiveBnb;
        uint256 tokensOut = effectiveTokens - newEffectiveTokens;
        require(tokensOut > 0 && tokensOut <= info.realTokens, "Bad output");
        info.realBnb += bnbIn;
        info.realTokens -= tokensOut;
        info.totalFeesCollected += fee;
        _distributeFee(info, fee);
        TunaToken(_token).transfer(_recipient, tokensOut);
        uint256 newPrice = _getPrice(info);
        uint256 progress = (info.realBnb * 10000) / GRADUATION_THRESHOLD;
        if (progress > 10000) progress = 10000;
        emit Trade(_token, _recipient, true, msg.value, tokensOut, fee, newPrice, info.realBnb, progress);
        if (info.realBnb >= GRADUATION_THRESHOLD) { _graduate(_token); }
    }

    function sell(address _token, uint256 _tokenAmount) external {
        TokenInfo storage info = tokens[_token];
        require(info.creator != address(0), "Token not found");
        require(!info.graduated, "Graduated");
        require(_tokenAmount > 0, "No tokens");
        TunaToken(_token).transferFrom(msg.sender, address(this), _tokenAmount);
        uint256 effectiveBnb = info.virtualBnb + info.realBnb;
        uint256 effectiveTokens = info.virtualTokens + info.realTokens;
        uint256 k = effectiveBnb * effectiveTokens;
        uint256 newEffectiveTokens = effectiveTokens + _tokenAmount;
        uint256 newEffectiveBnb = k / newEffectiveTokens;
        uint256 bnbOut = effectiveBnb - newEffectiveBnb;
        require(bnbOut > 0 && bnbOut <= info.realBnb, "Bad output");
        uint256 fee = (bnbOut * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 bnbToSeller = bnbOut - fee;
        info.realBnb -= bnbOut;
        info.realTokens += _tokenAmount;
        info.totalFeesCollected += fee;
        _distributeFee(info, fee);
        (bool sent, ) = msg.sender.call{value: bnbToSeller}("");
        require(sent, "Transfer failed");
        uint256 newPrice = _getPrice(info);
        uint256 progress = (info.realBnb * 10000) / GRADUATION_THRESHOLD;
        if (progress > 10000) progress = 10000;
        emit Trade(_token, msg.sender, false, bnbOut, _tokenAmount, fee, newPrice, info.realBnb, progress);
    }

    function _graduate(address _token) internal {
        TokenInfo storage info = tokens[_token];
        info.graduated = true;
        emit Graduated(_token, address(0), info.realBnb, LP_TOKENS);
    }

    function _distributeFee(TokenInfo storage info, uint256 fee) internal {
        uint256 creatorShare = (fee * info.creatorFeeBps) / BPS_DENOMINATOR;
        uint256 platformShare = fee - creatorShare;
        if (platformShare > 0) { (bool sent, ) = platformWallet.call{value: platformShare}(""); }
    }

    function claimCreatorFees(address _token) external {
        TokenInfo storage info = tokens[_token];
        require(msg.sender == info.creator, "Not creator");
        uint256 totalCreatorFees = (info.totalFeesCollected * info.creatorFeeBps) / BPS_DENOMINATOR;
        uint256 claimable = totalCreatorFees - info.creatorFeesClaimed;
        require(claimable > 0, "Nothing to claim");
        info.creatorFeesClaimed += claimable;
        (bool sent, ) = msg.sender.call{value: claimable}("");
        require(sent, "Transfer failed");
        emit FeesClaimed(_token, msg.sender, claimable);
    }

    function _getPrice(TokenInfo storage info) internal view returns (uint256) {
        uint256 effectiveBnb = info.virtualBnb + info.realBnb;
        uint256 effectiveTokens = info.virtualTokens + info.realTokens;
        return (effectiveBnb * 1e18) / effectiveTokens;
    }

    function getPrice(address _token) external view returns (uint256) { return _getPrice(tokens[_token]); }

    function getTokenInfo(address _token) external view returns (address creator, uint256 creatorFeeBps, uint256 realBnb, uint256 realTokens, uint256 bondingProgress, bool graduated, uint256 totalFeesCollected, uint256 price) {
        TokenInfo storage info = tokens[_token];
        uint256 progress = (info.realBnb * 10000) / GRADUATION_THRESHOLD;
        if (progress > 10000) progress = 10000;
        return (info.creator, info.creatorFeeBps, info.realBnb, info.realTokens, progress, info.graduated, info.totalFeesCollected, _getPrice(info));
    }

    function getTokenCount() external view returns (uint256) { return allTokens.length; }

    function predictTokenAddress(string calldata _name, string calldata _symbol, bytes32 _salt) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(type(TunaToken).creationCode, abi.encode(_name, _symbol, address(this), TOTAL_SUPPLY));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt, keccak256(bytecode)));
        return address(uint160(uint256(hash)));
    }

    function setPlatformWallet(address _wallet) external onlyOwner { platformWallet = _wallet; }
    function transferOwnership(address _newOwner) external onlyOwner { owner = _newOwner; }
    receive() external payable {}
}`;

// ============================================================================
// Solidity Compiler
// ============================================================================
async function compileSaturnPortal(): Promise<{ abi: any[]; bytecode: `0x${string}` }> {
  const t0 = Date.now();
  console.log("[Compile] Fetching Solidity compiler...");

  const solcUrl = "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";
  const response = await fetch(solcUrl);
  if (!response.ok) throw new Error(`Failed to fetch compiler: HTTP ${response.status}`);
  const solcCode = await response.text();
  console.log(`[Compile] Compiler fetched in ${Date.now() - t0}ms`);

  const moduleObj = { exports: {} as any };
  const fn = new Function("module", "exports", "require", solcCode + "\n//# sourceURL=soljson.js");
  fn(moduleObj, moduleObj.exports, () => ({}));

  const soljson = moduleObj.exports;
  if (!soljson?.cwrap) throw new Error("Compiler init failed");

  const compile = soljson.cwrap("solidity_compile", "string", ["string", "number", "number"]);

  const input = JSON.stringify({
    language: "Solidity",
    sources: { "SaturnPortal.sol": { content: SATURN_PORTAL_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });

  const output = JSON.parse(compile(input, 0, 0));

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      throw new Error(`Compilation errors:\n${errors.map((e: any) => e.formattedMessage || e.message).join("\n")}`);
    }
  }

  const contract = output.contracts?.["SaturnPortal.sol"]?.["SaturnPortal"];
  if (!contract) throw new Error("SaturnPortal not found in output");

  const bytecodeHex = contract.evm?.bytecode?.object;
  if (!bytecodeHex || bytecodeHex.length < 100) throw new Error("Invalid bytecode");

  console.log(`[Compile] Done in ${Date.now() - t0}ms. Bytecode: ${bytecodeHex.length} hex chars`);
  return { abi: contract.abi, bytecode: `0x${bytecodeHex}` as `0x${string}` };
}

// ============================================================================
// Handler
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(JSON.stringify({ error: "Deployer key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const platformWallet = body.platformWallet || Deno.env.get("BNB_PLATFORM_WALLET");
    if (!platformWallet) {
      return new Response(JSON.stringify({ error: "Platform wallet not provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`) as `0x${string}`
    );

    const ALCHEMY_KEY = Deno.env.get("ALCHEMY_BSC_API_KEY");
    const BSC_RPC = ALCHEMY_KEY ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "https://bsc-dataseed.binance.org";
    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });

    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`[Portal Deploy] Deployer: ${account.address}, Balance: ${formatEther(balance)} BNB`);

    if (balance < 50000000000000000n) { // 0.05 BNB minimum
      return new Response(JSON.stringify({
        error: `Insufficient BNB. Balance: ${formatEther(balance)} BNB. Need at least 0.05 BNB for deployment gas.`,
        deployer: account.address,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compile
    console.log("[Portal Deploy] Compiling SaturnPortal...");
    const { abi, bytecode } = await compileSaturnPortal();

    // Deploy
    console.log("[Portal Deploy] Deploying SaturnPortal...");
    const deployHash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [platformWallet as `0x${string}`],
    });

    console.log(`[Portal Deploy] Tx: ${deployHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash, confirmations: 2, timeout: 120_000,
    });

    const portalAddress = receipt.contractAddress;
    if (!portalAddress) throw new Error("No contract address in receipt");

    console.log(`[Portal Deploy] ✅ SaturnPortal deployed at: ${portalAddress}`);

    return new Response(JSON.stringify({
      success: true,
      portalAddress,
      txHash: deployHash,
      deployer: account.address,
      platformWallet,
      network: "bnb",
      chainId: 56,
      explorerUrl: `https://bscscan.com/address/${portalAddress}`,
      message: `SaturnPortal deployed at ${portalAddress}. Set BNB_PORTAL_ADDRESS secret to this value.`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[Portal Deploy] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Deployment failed",
      details: error instanceof Error ? error.stack : undefined,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
