import { SVGProps } from "react";

/** Lightweight X (Twitter) logo icon — avoids importing the full @phosphor-icons/react bundle */
export function XIcon(props: SVGProps<SVGSVGElement> & { className?: string; weight?: string }) {
  const { weight, ...rest } = props;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" {...rest}>
      <path d="M214.75 211.71l-62.6-98.38 61.77-67.95a8 8 0 0 0-11.84-10.76l-55.54 61.1L96.08 12.29A8 8 0 0 0 89.18 8H48a8 8 0 0 0-6.75 12.29l62.6 98.38-61.77 68a8 8 0 1 0 11.84 10.76l55.54-61.1 50.46 79.63A8 8 0 0 0 166.82 220H208a8 8 0 0 0 6.75-8.29z" />
    </svg>
  );
}
