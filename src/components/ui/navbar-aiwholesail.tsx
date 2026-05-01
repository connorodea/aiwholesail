import { useState, useRef, useEffect, useCallback } from "react";
import {
  IconChevronDown,
  IconMenu2,
  IconX,
  IconChevronRight,
  IconSearch,
  IconChartBar,
  IconBell,
  IconTarget,
  IconUsers,
  IconMail,
  IconFileText,
  IconArrowRight,
  IconCalculator,
  IconBook,
  IconBuildingSkyscraper,
  IconHome,
  IconCash,
  IconTrendingUp,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const aiWholesailLogo = "/logo-white.png";

type LinkItem = {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DropdownConfig = {
  label: string;
  columns: [LinkItem[], LinkItem[]];
  columnHeadings: [string, string];
};

const dropdowns: DropdownConfig[] = [
  {
    label: "Features",
    columnHeadings: ["Find Deals", "Manage Deals"],
    columns: [
      [
        { label: "Property Search", description: "Search any market instantly", href: "/app", icon: IconSearch },
        { label: "Deal Scoring", description: "AI scores every property 0-100", href: "/app/analyzer", icon: IconChartBar },
        { label: "Property Alerts", description: "Get notified on new opportunities", href: "/app/alerts", icon: IconBell },
        { label: "Market Intelligence", description: "Understand any market in seconds", href: "/markets", icon: IconBuildingSkyscraper },
      ],
      [
        { label: "Deal Pipeline", description: "Track deals from lead to close", href: "/app/pipeline", icon: IconTarget },
        { label: "Buyer Matching", description: "Match buyers to properties", href: "/app/buyers", icon: IconUsers },
        { label: "Follow-up Sequences", description: "Automated seller outreach", href: "/app/sequences", icon: IconMail },
        { label: "Contract Generator", description: "Create contracts in seconds", href: "/app/contracts", icon: IconFileText },
      ],
    ],
  },
  {
    label: "Resources",
    columnHeadings: ["Learn", "Tools"],
    columns: [
      [
        { label: "Blog", description: "Guides and market insights", href: "/blog", icon: IconBook },
        { label: "Use Cases", description: "How professionals use AIWholesail", href: "/use-cases", icon: IconUsers },
        { label: "Markets", description: "Browse 50+ US markets", href: "/markets", icon: IconBuildingSkyscraper },
        { label: "About Us", description: "Our story and mission", href: "/about", icon: IconHome },
      ],
      [
        { label: "Mortgage Calculator", description: "Monthly payment estimates", href: "/tools/mortgage-calculator", icon: IconCalculator },
        { label: "Deal Calculator", description: "Calculate your profit", href: "/tools/wholesale-deal-calculator", icon: IconCash },
        { label: "ARV Calculator", description: "Estimate property values", href: "/tools/arv-calculator", icon: IconTrendingUp },
        { label: "All Free Tools", description: "8 professional calculators", href: "/tools", icon: IconArrowRight },
      ],
    ],
  },
];

const plainLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export function NavbarAIWholesail() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  const openDropdown = useCallback((label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(label);
  }, []);

  const closeDropdown = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
  }, []);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return (
    <div className="fixed top-4 inset-x-0 z-50 mx-auto w-[95%] max-w-5xl">
      <header className="rounded-2xl bg-neutral-950 shadow-xl shadow-black/50 ring-1 ring-white/10" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 0 rgba(255,255,255,0.03) inset, 0 -1px 0 0 rgba(0,0,0,0.2) inset, 0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)' }}>
        <div className="px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex shrink-0 items-center">
              <img src={aiWholesailLogo} alt="AIWholesail" className="h-8 w-auto object-contain" />
            </Link>

            {/* Desktop Nav */}
            <DesktopNav activeDropdown={activeDropdown} onOpen={openDropdown} onClose={closeDropdown} />

            {/* Right buttons */}
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 lg:flex">
                {user ? (
                  <Link to="/app" className="rounded-md bg-gradient-to-b from-neutral-100 to-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-950 ring-1 ring-white/70 hover:from-white hover:to-neutral-200 transition-all" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3), 0 1px 0 0 rgba(255,255,255,0.9) inset, 0 -1px 0 0 rgba(0,0,0,0.08) inset' }}>
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors">
                      Sign in
                    </Link>
                    <Link to="/pricing" className="rounded-md bg-gradient-to-b from-neutral-100 to-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-950 ring-1 ring-white/70 hover:from-white hover:to-neutral-200 transition-all" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3), 0 1px 0 0 rgba(255,255,255,0.9) inset, 0 -1px 0 0 rgba(0,0,0,0.08) inset' }}>
                      Get started
                    </Link>
                  </>
                )}
              </div>
              <button
                aria-label="Toggle menu"
                className="relative inline-flex size-9 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-white lg:hidden"
                onClick={() => setMobileOpen(s => !s)}
              >
                {mobileOpen ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile */}
        <AnimatePresence initial={false}>
          {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} user={user} />}
        </AnimatePresence>
      </header>
    </div>
  );
}

function DesktopNav({ activeDropdown, onOpen, onClose }: { activeDropdown: string | null; onOpen: (l: string) => void; onClose: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  const activeConfig = dropdowns.find(d => d.label === activeDropdown);

  return (
    <nav ref={navRef} className="relative hidden items-center gap-1 lg:flex" onMouseLeave={onClose}>
      {dropdowns.map(dd => (
        <button
          key={dd.label}
          className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          onMouseEnter={() => onOpen(dd.label)}
          onClick={() => activeDropdown === dd.label ? onClose() : onOpen(dd.label)}
          aria-expanded={activeDropdown === dd.label}
        >
          {dd.label}
          <IconChevronDown className={`size-3.5 text-neutral-500 transition-transform duration-200 ${activeDropdown === dd.label ? "rotate-180" : ""}`} />
        </button>
      ))}
      {plainLinks.map(link => (
        <Link key={link.label} to={link.href} className="rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors" onMouseEnter={onClose}>
          {link.label}
        </Link>
      ))}

      <AnimatePresence>
        {activeConfig && (
          <motion.div
            key="dropdown-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 z-50 pt-3"
            onMouseEnter={() => onOpen(activeConfig.label)}
          >
            <motion.div
              layout
              transition={springTransition}
              className="overflow-hidden rounded-xl bg-neutral-900 p-2 ring-1 ring-white/10"
              style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4), 0 1px 0 0 rgba(255,255,255,0.06) inset, 0 -1px 0 0 rgba(0,0,0,0.2) inset' }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeConfig.label}
                  initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  <DropdownContent config={activeConfig} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function DropdownContent({ config }: { config: DropdownConfig }) {
  const [col1, col2] = config.columns;
  const [heading1, heading2] = config.columnHeadings;

  return (
    <div className="grid w-[32rem] grid-cols-2 gap-0">
      <div className="p-1">
        <p className="px-2 pt-2 pb-1.5 text-xs font-medium text-neutral-500">{heading1}</p>
        <ul className="grid gap-0.5">
          {col1.map(item => <li key={item.label}><LinkRow item={item} /></li>)}
        </ul>
      </div>
      <div className="border-l border-white/[0.06] p-1">
        <p className="px-2 pt-2 pb-1.5 text-xs font-medium text-neutral-500">{heading2}</p>
        <ul className="grid gap-0.5">
          {col2.map(item => <li key={item.label}><LinkRow item={item} /></li>)}
        </ul>
      </div>
    </div>
  );
}

function LinkRow({ item }: { item: LinkItem }) {
  return (
    <Link to={item.href} className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-white/[0.06] transition-colors">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-800/80 ring-1 ring-white/[0.08] group-hover:bg-neutral-800" style={{ boxShadow: '0 1px 0 0 rgba(255,255,255,0.06) inset' }}>
        <item.icon className="size-4 text-neutral-400 group-hover:text-white transition-colors" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200 group-hover:text-white">{item.label}</p>
        <p className="text-xs text-neutral-500 group-hover:text-neutral-400">{item.description}</p>
      </div>
    </Link>
  );
}

function MobileNav({ onClose, user }: { onClose: () => void; user: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-white/[0.08] lg:hidden"
    >
      <div className="px-4 py-4 sm:px-6">
        {dropdowns.map(dd => <MobileDropdown key={dd.label} config={dd} onClose={onClose} />)}
        {plainLinks.map(link => (
          <Link key={link.label} to={link.href} onClick={onClose} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/[0.06]">
            <span>{link.label}</span>
            <IconChevronRight className="size-4 text-neutral-600" />
          </Link>
        ))}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
          {user ? (
            <Link to="/app" onClick={onClose} className="rounded-md bg-gradient-to-b from-neutral-100 to-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-950 ring-1 ring-white/70" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 1px 0 0 rgba(255,255,255,0.9) inset' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/auth" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-white">Sign in</Link>
              <Link to="/pricing" onClick={onClose} className="rounded-md bg-gradient-to-b from-neutral-100 to-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-950 ring-1 ring-white/70" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 1px 0 0 rgba(255,255,255,0.9) inset' }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MobileDropdown({ config, onClose }: { config: DropdownConfig; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const allItems = [...config.columns[0], ...config.columns[1]];

  return (
    <div>
      <button className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/[0.06]" onClick={() => setOpen(s => !s)}>
        <span>{config.label}</span>
        <IconChevronDown className={`size-4 text-neutral-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="py-1 pl-3">
              {allItems.map(item => (
                <Link key={item.label} to={item.href} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.06]">
                  <item.icon className="size-4 shrink-0 text-neutral-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-300">{item.label}</p>
                    <p className="text-xs text-neutral-600">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
