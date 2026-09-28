import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

// ----- TabsList variants ---------------------------------------------------

const tabsListVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      // Match the project's prior shadcn-derived defaults exactly so the
      // 28 existing TabsList callsites that don't pass `variant` keep
      // their look. DO NOT change without auditing every consumer.
      default: 'h-10 p-1 rounded-md text-muted-foreground dark:bg-transparent',
      line: 'h-auto rounded-none bg-transparent p-0 text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>

// React context to propagate the variant down to TabsTrigger so callers don't
// have to repeat `variant="line"` on every trigger.
const TabsVariantContext = React.createContext<'default' | 'line'>('default')

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant ?? 'default'}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

// ----- TabsTrigger variants ------------------------------------------------

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'rounded-md px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
        line: [
          'relative rounded-none px-3 py-2 bg-transparent text-muted-foreground',
          'before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:scale-x-0 before:bg-pos-gold',
          'before:transition-transform before:duration-300 before:ease-in-out',
          'data-[state=active]:text-foreground data-[state=active]:before:scale-x-100',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> &
  VariantProps<typeof tabsTriggerVariants>

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => {
  const ctxVariant = React.useContext(TabsVariantContext)
  const effectiveVariant = variant ?? ctxVariant
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        tabsTriggerVariants({ variant: effectiveVariant }),
        className,
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

// ----- TabsContent (unchanged) --------------------------------------------

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
