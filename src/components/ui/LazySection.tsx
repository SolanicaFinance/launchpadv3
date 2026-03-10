import { useRef, useState, useEffect, ReactNode } from "react";

/**
 * Renders children only when the component scrolls into view.
 * Uses IntersectionObserver for zero-cost until visible.
 */
export function LazySection({
  children,
  fallback,
  rootMargin = "200px",
  className,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : (fallback || <div style={{ minHeight: 200 }} />)}
    </div>
  );
}
