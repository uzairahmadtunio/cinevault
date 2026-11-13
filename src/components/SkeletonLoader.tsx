// Shimmer animation with CSS
const shimmerStyle = `
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    to right,
    #111827 0%,
    #1f2937 50%,
    #111827 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
`;

export function SkeletonLoader() {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 justify-items-center px-4 md:px-8">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-[200px]">
            <div className="aspect-[2/3] rounded-lg skeleton-shimmer" />
            <div className="mt-2 space-y-2">
              <div className="h-3 rounded skeleton-shimmer" />
              <div className="h-2 rounded skeleton-shimmer w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function PaginationSkeletonLoader() {
  return (
    <div className="flex gap-2 justify-center mt-6 flex-wrap px-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-10 h-10 rounded skeleton-shimmer"
        />
      ))}
    </div>
  );
}
