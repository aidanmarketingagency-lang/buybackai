"use client";

export default function OrbField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main center orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-green-500/10 blur-[120px] float-slow" />

      {/* Smaller drifting orbs */}
      <div className="absolute top-[20%] left-[15%] w-[300px] h-[300px] rounded-full bg-blue-500/8 blur-[100px] float" />
      <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-500/6 blur-[120px] float-slow" />
      <div className="absolute top-[60%] left-[8%] w-[250px] h-[250px] rounded-full bg-green-400/8 blur-[80px] float-fast" />

      {/* Subtle scan line */}
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/30 to-transparent scan-line" />
      </div>
    </div>
  );
}
