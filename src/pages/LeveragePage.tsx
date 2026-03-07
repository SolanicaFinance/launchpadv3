import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { LeverageTerminal } from "@/components/leverage/LeverageTerminal";

export default function LeveragePage() {
  return (
    <LaunchpadLayout hideFooter noPadding>
      <LeverageTerminal />
    </LaunchpadLayout>
  );
}
