"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;

  return (
    <TabsContext.Provider
      value={{
        value: currentValue,
        setValue: (nextValue) => {
          setInternalValue(nextValue);
          onValueChange?.(nextValue);
        }
      }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-auto w-full items-center rounded-2xl bg-secondary/70 p-1.5",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  value,
  children
}: {
  className?: string;
  value: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs.");
  }

  const isActive = context.value === value;

  return (
    <button
      className={cn(
        "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => context.setValue(value)}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({
  className,
  value,
  children
}: {
  className?: string;
  value: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(TabsContext);

  if (!context || context.value !== value) {
    return null;
  }

  return <div className={className}>{children}</div>;
}
