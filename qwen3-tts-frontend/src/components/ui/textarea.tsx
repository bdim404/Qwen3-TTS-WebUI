import * as React from "react"

import { cn, debounce } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement>(null)

  React.useImperativeHandle(ref, () => internalRef.current!)

  const adjustHeight = React.useCallback((element: HTMLTextAreaElement) => {
    element.style.height = 'auto'
    const maxHeight = window.innerWidth >= 768
      ? Math.min(400, window.innerHeight * 0.5)
      : window.innerHeight * 0.6
    const newHeight = Math.min(element.scrollHeight, maxHeight)
    element.style.height = `${newHeight}px`
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  React.useLayoutEffect(() => {
    const element = internalRef.current
    if (element) {
      adjustHeight(element)
    }
  }, [props.value, props.defaultValue, adjustHeight])

  React.useEffect(() => {
    const element = internalRef.current
    if (!element) return

    const handleInput = () => adjustHeight(element)
    const handleResize = debounce(() => adjustHeight(element), 250)

    element.addEventListener('input', handleInput)
    window.addEventListener('resize', handleResize)

    return () => {
      element.removeEventListener('input', handleInput)
      window.removeEventListener('resize', handleResize)
    }
  }, [adjustHeight])

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden",
        className
      )}
      ref={internalRef}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
