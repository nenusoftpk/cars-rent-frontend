export function LoadingScreen({ inline }) {
  return (
    <div className={inline ? 'grid place-items-center py-32' : 'min-h-screen grid place-items-center bg-page'} role="status" aria-label="Loading">
      <div className="size-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}
