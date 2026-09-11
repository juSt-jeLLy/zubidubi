import { Component, type ErrorInfo, type ReactNode } from "react";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  /** Short label used in error reports. */
  label?: string;
  /** Inline heading shown when the section fails. */
  title?: string;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * Catches render/child errors inside one page section so a single widget
 * can never take down the whole route with TanStack's root error page.
 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? "section";
    console.error(`[${label}] render error:`, error, info.componentStack ?? "");
    reportLovableError(error, { boundary: `section_boundary:${label}` });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="panel mt-8 p-5" role="alert">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {this.props.title ?? "This section couldn't load"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : String(error)}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={this.reset} className="mt-4 font-semibold">
            <RotateCcw className="size-3.5" />
            Retry section
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
