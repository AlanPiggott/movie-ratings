import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0E0F13]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
              About
            </Link>
            <span className="text-gray-600">·</span>
            <Link href="/faq" className="text-gray-400 hover:text-white transition-colors">
              FAQ
            </Link>
          </div>

          {/* Disclaimer */}
          <div className="text-center md:text-right text-xs text-gray-500">
            <p>Not affiliated with Google LLC</p>
            <p className="mt-1">Data sourced from public search results</p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Movie Score. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}