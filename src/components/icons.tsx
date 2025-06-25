import type { SVGProps } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const Logo = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={cn("relative", props.className)}>
    <Image
      src="/logo/light_KCS.png"
      alt="Krishna Connect Logo"
      fill
      sizes="10vw"
      className="block dark:hidden object-contain"
      priority
    />
    <Image
      src="/logo/dark_KCS.png"
      alt="Krishna Connect Logo"
      fill
      sizes="10vw"
      className="hidden dark:block object-contain"
      priority
    />
  </div>
);

export const Icons = {
  logo: Logo,
  google: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="1em"
      height="1em"
      {...props}
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.223 0-9.655-3.657-11.303-8.653l-6.571 4.819C9.656 39.663 16.318 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.426 44 30.638 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  ),
  facebook: (props: SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        {...props}
    >
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  ),
  apple: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 256 256"
      {...props}
    >
      <path
        fill="currentColor"
        d="M208.33 103.33c0-25.32 15.84-44.13 40-50.67a147.2 147.2 0 0 0-41.9-25.22c-17.1-7.24-38.33-8.7-55.73 4.41-14.28 10.79-25.74 30.67-41.33 30.67S84.1 33.32 69.82 22.53C49.94 8.7 26.59 5.87 8.33 17.17c-21.78 13.48-22 45.42 2.84 65.15C29.09 98.12 45 104 57.67 104c13.48 0 26.59-6.45 42-6.45s28.52 6.45 42 6.45c11.3 0 23.3-3.62 36.66-10.67M168.33 120c-16.52 0-33.72 8.7-47.42 8.7s-30.9-8.7-47.42-8.7c-20.06 0-39.78 12.18-50.57 30.09-11.38 18.83-12.86 41.33-2.84 59.81 9.4 17.41 27.42 28.52 47.42 28.52 16.52 0 33.15-8.7 46.85-8.7s30.33 8.7 46.85 8.7c19.49 0 36.88-10.89 46.28-28.52 10.89-19.49 8.7-44.14-5.69-61.54-10.89-13.48-28.52-28.45-48.27-28.45Z"
      />
    </svg>
  ),
};
