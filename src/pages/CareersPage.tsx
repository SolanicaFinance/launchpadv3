import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Code2,
  Brain,
  Shield,
  Palette,
  Users,
  Megaphone,
  Server,
  Smartphone,
  TestTube,
  Zap,
  Globe,
  MessageCircle,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import { Footer } from "@/components/layout/Footer";
import { MatrixContentCard } from "@/components/layout/MatrixContentCard";

interface Position {
  title: string;
  department: string;
  type: "Full-time" | "Part-time" | "Contract" | "Volunteer";
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requirements: string[];
  priority: "Critical" | "High" | "Medium";
}

const positions: Position[] = [
  {
    title: "Senior Solana Developer",
    department: "Engineering",
    type: "Full-time",
    icon: Code2,
    description: "Build and maintain core smart contracts, token launch infrastructure, and DBC pool integrations on Solana.",
    requirements: [
      "5+ years blockchain development",
      "Expert in Rust and Anchor framework",
      "Experience with Metaplex, Jupiter, Meteora",
      "Deep understanding of Solana runtime",
    ],
    priority: "Critical",
  },
  {
    title: "AI/ML Engineer",
    department: "AI Research",
    type: "Full-time",
    icon: Brain,
    description: "Develop autonomous agent intelligence, trading algorithms, and machine learning models for token analysis.",
    requirements: [
      "PhD or 5+ years in ML/AI",
      "Experience with LLMs and agent frameworks",
      "Python, PyTorch/TensorFlow expertise",
      "NLP and reinforcement learning background",
    ],
    priority: "Critical",
  },
  {
    title: "Security Engineer",
    department: "Security",
    type: "Full-time",
    icon: Shield,
    description: "Audit smart contracts, implement security protocols, and protect the platform from exploits and attacks.",
    requirements: [
      "5+ years security engineering",
      "Smart contract auditing experience",
      "Penetration testing expertise",
      "Bug bounty program management",
    ],
    priority: "Critical",
  },
  {
    title: "Backend Systems Architect",
    department: "Engineering",
    type: "Full-time",
    icon: Server,
    description: "Design and scale the infrastructure powering thousands of autonomous agents and real-time trading systems.",
    requirements: [
      "7+ years distributed systems",
      "Supabase/PostgreSQL expertise",
      "Experience with edge functions and serverless",
      "High-frequency trading systems background",
    ],
    priority: "High",
  },
  {
    title: "Frontend Lead (React/TypeScript)",
    department: "Engineering",
    type: "Full-time",
    icon: Smartphone,
    description: "Lead the development of our web platform, dashboards, and real-time trading interfaces.",
    requirements: [
      "5+ years React/TypeScript",
      "Web3 wallet integration experience",
      "Real-time data visualization",
      "Performance optimization expertise",
    ],
    priority: "High",
  },
  {
    title: "Product Designer (Web3)",
    department: "Design",
    type: "Full-time",
    icon: Palette,
    description: "Create intuitive, beautiful interfaces for complex DeFi and AI agent interactions.",
    requirements: [
      "4+ years product design",
      "Strong Web3/DeFi portfolio",
      "Figma and prototyping expertise",
      "Understanding of trading UX patterns",
    ],
    priority: "High",
  },
  {
    title: "Developer Relations Engineer",
    department: "Community",
    type: "Full-time",
    icon: Users,
    description: "Build and nurture our developer community, create SDKs, documentation, and enable third-party integrations.",
    requirements: [
      "3+ years DevRel experience",
      "Strong technical background",
      "Excellent communication skills",
      "Open source contribution history",
    ],
    priority: "High",
  },
  {
    title: "Growth Marketing Lead",
    department: "Marketing",
    type: "Full-time",
    icon: Megaphone,
    description: "Drive user acquisition, brand awareness, and community growth across crypto-native channels.",
    requirements: [
      "5+ years growth marketing",
      "Crypto/DeFi marketing experience",
      "Data-driven decision making",
      "Influencer relationship management",
    ],
    priority: "Medium",
  },
  {
    title: "Quantitative Researcher",
    department: "Trading",
    type: "Full-time",
    icon: Zap,
    description: "Research and develop trading strategies, market microstructure analysis, and alpha generation for AI agents.",
    requirements: [
      "Quantitative finance background",
      "Statistical modeling expertise",
      "Crypto market experience",
      "Python/R proficiency",
    ],
    priority: "Medium",
  },
  {
    title: "Technical Writer",
    department: "Documentation",
    type: "Contract",
    icon: Globe,
    description: "Create comprehensive documentation, tutorials, and educational content for the Claw SDK and platform.",
    requirements: [
      "3+ years technical writing",
      "Developer documentation experience",
      "Understanding of APIs and SDKs",
      "Markdown and docs-as-code workflows",
    ],
    priority: "Medium",
  },
];

const betaTesterBenefits = [
  "Early access to unreleased features",
  "Direct influence on product direction",
  "Private Discord channel with core team",
  "Recognition as founding community member",
  "Potential token allocation for active testers",
  "First access to trading agent features",
];

export default function CareersPage() {
  const handleApplyClick = () => {
    window.open("https://x.com/messages/compose?recipient_id=clawmode", "_blank");
  };

  const getPriorityColor = (priority: Position["priority"]) => {
    switch (priority) {
      case "Critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "High":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "Medium":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Saturn</span>
          </Link>
          <Button onClick={handleApplyClick} className="bg-primary hover:bg-primary/90 gap-2">
            <XLogo className="h-4 w-4" weight="fill" />
            DM Us to Apply
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <MatrixContentCard>
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 text-sm px-4 py-1">
            We're Hiring
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Build the Future of{" "}
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
              Autonomous AI
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Join the team building Saturn — the world's first AI agent operating system for autonomous trading and token launches on Solana.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-sm">Remote-First Team</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm">Cutting-Edge Tech Stack</span>
            </div>
          </div>
        </div>
      </section>

      {/* Current Status Banner */}
      <section className="px-4 mb-12">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-primary/30">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">🚀 Expanding Our Team</h3>
              <p className="text-muted-foreground">
                We're currently in expansion mode with no positions filled yet. This is your chance to be a founding team member 
                and help shape the direction of autonomous AI agents on Solana. All positions are open for exceptional candidates.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Open Positions */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Open Positions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We're looking for world-class talent to build the next generation of autonomous AI infrastructure. 
              All roles offer competitive compensation, token allocation, and the opportunity to work on groundbreaking technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {positions.map((position, index) => (
              <Card key={index} className="bg-card/50 border-border hover:border-primary/50 transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <position.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{position.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{position.department}</p>
                      </div>
                    </div>
                    <Badge className={getPriorityColor(position.priority)}>{position.priority}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{position.description}</p>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Requirements:</p>
                    <ul className="space-y-1">
                      {position.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="outline" className="text-xs">{position.type}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={handleApplyClick}
                    >
                      <XLogo className="h-3 w-3" weight="fill" />
                      Apply via DM
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Testers Section */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/30 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <TestTube className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Beta Testers Wanted</CardTitle>
                  <p className="text-muted-foreground">Help shape the future of Saturn</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                We're looking for experienced crypto users, developers, and traders to beta test the Saturn platform 
                before public launch. As a beta tester, you'll get early access to features, provide feedback directly 
                to the team, and help us identify and fix issues.
              </p>
              
              <div>
                <h4 className="font-semibold mb-3">What You'll Get:</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {betaTesterBenefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleApplyClick}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
                >
                  <XLogo className="h-4 w-4" weight="fill" />
                  Apply to Become a Beta Tester
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">Why Join Saturn?</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <Card className="bg-card/50 border-border">
              <CardContent className="p-6 text-center">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto mb-4">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Pioneering Technology</h3>
                <p className="text-sm text-muted-foreground">
                  Work on the cutting edge of AI agents, autonomous systems, and blockchain technology.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-6 text-center">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Remote-First Culture</h3>
                <p className="text-sm text-muted-foreground">
                  Work from anywhere in the world with a distributed team of exceptional talent.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border">
              <CardContent className="p-6 text-center">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Token Allocation</h3>
                <p className="text-sm text-muted-foreground">
                  Earn a stake in the protocol with competitive token allocation for all team members.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-8">
              <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">Ready to Apply?</h2>
              <p className="text-muted-foreground mb-6">
                Send us a DM on X with your background, the position you're interested in, and why you want to join Saturn. 
                We review every application and respond within 48 hours.
              </p>
              <Button
                size="lg"
                onClick={handleApplyClick}
                className="bg-primary hover:bg-primary/90 gap-2"
              >
                <XLogo className="h-5 w-5" weight="fill" />
                DM @saturntrade on X
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
      </MatrixContentCard>

      {/* Footer */}
      {/* Footer */}
      <Footer />
    </div>
  );
}
