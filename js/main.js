// BâtiSwift — Utilitaires globaux, chargement différé

// ---- Page Loader ----
window.addEventListener('load', () => {
  const loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');
});

// ---- Animations reveal au scroll ----
document.addEventListener('DOMContentLoaded', () => {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach(el => observer.observe(el));

  // Nav mobile
  const burger = document.querySelector('.nav-hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      burger.classList.toggle('open');
    });
  }
});