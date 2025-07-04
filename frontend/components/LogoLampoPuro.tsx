import React from "react";

const LogoLampoPuro: React.FC<{ className?: string; size?: number }> = () => (
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" fill="none">
  <defs>
    <linearGradient id="fcGradient" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399" /> 
      <stop offset="100%" stop-color="#22c55e" /> 
    </linearGradient>
  </defs>

  <path d="M48 5.5c3.1 0 6.2.8 8.9 2.3l22.3 12.3c5.5 3 8.9 8.7 8.9 14.9v26.8c0 6.2-3.4 11.9-8.9 14.9L56.9 88C54.2 89.5 51.1 90.3 48 90.3s-6.2-.8-8.9-2.3L16.8 76.7C11.3 73.7 8 68 8 61.8V35c0-6.2 3.3-11.9 8.8-14.9L39.1 7.9A17.8 17.8 0 0 1 48 5.5z" fill="url(#fcGradient)"/>

  <path d="M34 30c4-2 9-3 14-3s10 1 14 3" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M30 48h-7" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <path d="M73 48h-7" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <path d="M34 66c4 2 9 3 14 3s10-1 14-3" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>

  <path d="M48 24l-8 16h10l-9 18 22-24h-12l10-10H48z" fill="#ffffff"/>
</svg>


);

export default LogoLampoPuro;
