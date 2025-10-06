import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useEffect, useState } from "react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            <ToastProgress duration={5000} />
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

function ToastProgress({ duration }: { duration: number }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / (duration / 100))));
    }, 100);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
      <div 
        className="h-full bg-primary transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
