import React from "react";

export default function Timer({ seconds }) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return (
    <div className="modern-timer">
      <div className="pulse-dot"/>
      <span>{m > 0 ? `${m}:${String(s).padStart(2, "0")}` : ` 0:${String(s).padStart(2, "0")}`}</span>
    </div>
  );
}
