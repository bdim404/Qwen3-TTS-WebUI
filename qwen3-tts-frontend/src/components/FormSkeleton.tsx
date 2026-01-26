const FormSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-10 bg-muted rounded" />
      </div>

      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-32" />
        <div className="h-10 bg-muted rounded" />
      </div>

      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-28" />
        <div className="h-32 bg-muted rounded" />
      </div>

      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-36" />
        <div className="h-10 bg-muted rounded" />
      </div>

      <div className="h-10 bg-muted rounded w-full" />
    </div>
  );
};

export default FormSkeleton;
