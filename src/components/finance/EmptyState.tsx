import React from "react";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center rounded-full bg-primary/6 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
