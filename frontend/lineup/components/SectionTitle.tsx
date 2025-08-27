import React from "react";

export default function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 text-xl font-bold text-content-100">
      {children}
    </div>
  );
}
