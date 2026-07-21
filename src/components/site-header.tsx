"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  ["Find a stay", "/search"],
  ["Group stays", "/group-accommodation"],
  ["List your property", "/become-a-host"],
  ["Help", "/help"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="shell nav-row">
        <Link className="brand" href="/" aria-label="Coast Bookings home">
          <Image src="/coastbookings-logo.svg" alt="" width={42} height={42} priority />
          <span>Coast <strong>Bookings</strong></span>
        </Link>
        <nav className={cn("primary-nav", open && "is-open")} aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link className="nav-login" href="/sign-in">Log in</Link>
          <Link className="button button-small" href="/sign-up">Create account</Link>
        </nav>
        <a className="whatsapp-link" href="https://wa.me/254700000000" aria-label="Chat on WhatsApp"><MessageCircle size={18} /> WhatsApp</a>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
