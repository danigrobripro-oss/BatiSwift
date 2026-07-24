import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom'; // si vous utilisez React Router – sinon remplacez par <a href="...">

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fermer le menu en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => setMobileMenuOpen(false);

  // Liens de navigation
  const navLinks = [
    { label: 'Accueil', href: '/' },
    { label: 'Déposer une demande', href: '/client' },
    { label: 'Tarifs', href: '/tarifs' },
    { label: 'Aide', href: '/aide' },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-beige-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-anthracite">
            <img src="/assets/logo.svg" alt="BâtiSwift" className="h-8 w-auto" />
            <span>BâtiSwift</span>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-gris hover:text-anthracite transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/connexion" className="btn btn-secondary btn-sm">
              Connexion
            </Link>
            <Link to="/inscription" className="btn btn-primary btn-sm">
              S'inscrire
            </Link>
          </div>

          {/* Bouton Burger (mobile) */}
          <button
            onClick={toggleMenu}
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-beige transition-colors"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            <span
              className={`block w-6 h-0.5 bg-anthracite transition-transform duration-300 ${
                mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-anthracite transition-opacity duration-300 ${
                mobileMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-anthracite transition-transform duration-300 ${
                mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Panneau Mobile */}
      <div
        ref={menuRef}
        className={`md:hidden absolute top-full left-0 w-full bg-white border-b border-beige-dark shadow-lg transition-all duration-300 ease-in-out overflow-hidden ${
          mobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 py-6 space-y-4">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={closeMenu}
              className="block w-full text-center py-3 text-base font-medium text-anthracite hover:bg-beige rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 pt-4 border-t border-beige-dark">
            <Link
              to="/connexion"
              onClick={closeMenu}
              className="btn btn-secondary btn-block justify-center"
            >
              Connexion
            </Link>
            <Link
              to="/inscription"
              onClick={closeMenu}
              className="btn btn-primary btn-block justify-center"
            >
              S'inscrire
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;