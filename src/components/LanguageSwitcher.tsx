"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // We use a hard reload here instead of router.replace() to prevent Next.js 
    // from re-mounting `next-themes` dynamically, which throws script injection errors.
    const newPath = `/${newLocale}${pathname === '/' ? '' : pathname}`;
    window.location.assign(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C8A856]">
        <Globe className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`font-medium cursor-pointer flex justify-between ${
              locale === lang.code ? "text-[#C8A856]" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
