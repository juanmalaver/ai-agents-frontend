interface LoadingSpinnerProps {
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  className = "h-4 w-4 text-teal-600",
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <span className="inline-flex items-center" role="status">
      <span
        aria-hidden="true"
        className={`${className} animate-spin rounded-full border-2 border-current border-t-transparent`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
