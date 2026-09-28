import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Design system §5: Primary = lime fill + blue text (the ONE action on a screen — UX principle 1).
// Secondary = blue fill + white text. Ghost = blue text. Destructive = danger outline.
// Heights follow §9: ≥ 44 px tap targets on the web (lg), 40 px in dense staff screens.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-redux-lime text-redux-blue hover:bg-[#65dc08]",
        secondary: "bg-redux-blue text-white hover:bg-redux-blue-2",
        outline: "border-line bg-white text-redux-blue hover:bg-surface",
        ghost: "text-redux-blue hover:bg-surface",
        destructive: "border-danger bg-white text-danger hover:bg-danger-bg",
        link: "text-redux-blue underline-offset-4 hover:underline",
        whatsapp: "bg-whatsapp text-ink hover:bg-[#1fbd5a]",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-[13px]",
        lg: "h-12 gap-2 px-6 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-7 rounded-sm",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
