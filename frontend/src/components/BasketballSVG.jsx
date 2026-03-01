import React from "react";

const BasketballSVG = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" />
    <path d="M50 6 C32 18 32 82 50 94" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M50 6 C68 18 68 82 50 94" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M6 50 C18 32 82 32 94 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <path d="M6 50 C18 68 82 68 94 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

export default BasketballSVG;
