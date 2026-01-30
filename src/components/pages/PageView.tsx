export const PageViewComponent = ({
  ref,
  children,
}: React.ComponentProps<'div'>) => {
  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto px-4 gap-12"
    >
      {children}
    </div>
  )
}
