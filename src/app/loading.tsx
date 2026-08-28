export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
      <div className="w-16 h-16 border-4 border-panel-border border-t-accent rounded-full animate-spin mb-4"></div>
      <p className="text-foreground/70 font-medium animate-pulse">Loading data...</p>
    </div>
  );
}
