// ---- Mobile navigation ----
const hamburger = document.getElementById('navHamburger');
const nav = document.querySelector('.nav-system');

if (hamburger && nav) {
  hamburger.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', nav.classList.contains('nav-open') ? 'true' : 'false');
  });
  nav.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) {
      nav.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---- Nav background on scroll ----
window.addEventListener('scroll', () => {
  if (!nav) return;
  nav.style.background = window.scrollY > 100 ? 'rgba(10, 14, 26, 0.95)' : 'rgba(10, 14, 26, 0.8)';
});

// ---- Fade-in on scroll ----
const fadeElements = document.querySelectorAll('.quick-card, .project-detail, .skill-category, .cert-card');
if (fadeElements.length) {
  const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  fadeElements.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeInObserver.observe(el);
  });
}

// ---- Project accordion ----
document.querySelectorAll('.project-header-section').forEach((header) => {
  header.addEventListener('click', () => {
    const scrollY = window.scrollY;
    const project = header.closest('.project-detail');
    document.querySelectorAll('.project-detail.active').forEach((other) => {
      if (other !== project) other.classList.remove('active');
    });
    project.classList.toggle('active');
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
  });
});

// ---- Open a project directly when linked via #project-… hash ----
if (window.location.hash.startsWith('#project-')) {
  const target = document.querySelector(window.location.hash);
  if (target && target.classList.contains('project-detail')) {
    target.classList.add('active');
    target.scrollIntoView({ block: 'start' });
  }
}

// ---- Screenshot lightbox ----
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const lightboxImg = document.getElementById('lightbox-img');
  const close = () => lightbox.classList.remove('open');
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('screenshot-img')) {
      lightboxImg.src = e.target.src;
      lightboxImg.alt = e.target.alt;
      lightbox.classList.add('open');
    }
  });
  document.getElementById('lightbox-overlay').addEventListener('click', close);
  document.getElementById('lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---- Project status + semester filter (projects page) ----
const projectFilter = document.getElementById('projectFilter');
const semesterFilter = document.getElementById('semesterFilter');
if (projectFilter) {
  const filterProjects = () => {
    const status = projectFilter.value;
    const semester = semesterFilter ? semesterFilter.value : 'all';
    document.querySelectorAll('.project-detail').forEach((project) => {
      const statusMatch = status === 'all' || project.dataset.status === status;
      const semesterMatch = semester === 'all' || project.dataset.semester === semester;
      project.style.display = statusMatch && semesterMatch ? 'block' : 'none';
    });
  };
  filterProjects();
  projectFilter.addEventListener('change', filterProjects);
  if (semesterFilter) semesterFilter.addEventListener('change', filterProjects);
}

// ---- Timeline category/semester filter (experience & visits pages) ----
const timelineCategory = document.getElementById('timelineCategory');
const timelineSemester = document.getElementById('timelineSemester');
const timelineItems = document.querySelectorAll('.timeline-item');
if (timelineItems.length) {
  const filterTimeline = () => {
    const category = timelineCategory ? timelineCategory.value : 'all';
    const semester = timelineSemester ? timelineSemester.value : 'all';
    timelineItems.forEach((item) => {
      const categoryMatch = category === 'all' || item.dataset.category === category;
      const semesterMatch = semester === 'all' || !item.dataset.semester || item.dataset.semester === semester;
      item.classList.toggle('active', categoryMatch && semesterMatch);
    });
  };
  filterTimeline();
  if (timelineCategory) timelineCategory.addEventListener('change', filterTimeline);
  if (timelineSemester) timelineSemester.addEventListener('change', filterTimeline);
}

// ---- Timeline expandable details ----
document.querySelectorAll('.timeline-item .timeline-toggle').forEach((toggleBtn) => {
  toggleBtn.addEventListener('click', () => {
    const item = toggleBtn.closest('.timeline-item');
    const expanded = item.classList.toggle('expanded');
    toggleBtn.textContent = expanded ? 'Hide Details ▲' : 'Show Details ▼';
  });
});

// ---- Skills page: semester filter + tooltip toggle ----
const skillsSemester = document.getElementById('skillsSemester');
if (skillsSemester) {
  const filterSkills = () => {
    const sem = skillsSemester.value;
    document.querySelectorAll('.hs-row, .soft-skill-card').forEach((el) => {
      const match = sem === 'all' || !el.dataset.semester || el.dataset.semester === sem || el.dataset.semester === 'both';
      el.style.display = match ? '' : 'none';
    });
  };
  filterSkills();
  skillsSemester.addEventListener('change', filterSkills);
}

const tipCheck = document.getElementById('tipCheck');
if (tipCheck) {
  const tipToggle = document.getElementById('tipToggle');
  const hsTable = document.querySelector('.hardskills-table');
  tipCheck.addEventListener('change', () => {
    hsTable.classList.toggle('tooltips-on', tipCheck.checked);
    tipToggle.classList.toggle('on', tipCheck.checked);
  });
}

// ---- Semester tabs (BTS goal page) ----
const semTabs = document.querySelectorAll('.sem-tab');
if (semTabs.length) {
  const semSections = document.querySelectorAll('section[data-semester]');
  const activateSemester = (sem) => {
    semTabs.forEach((t) => t.classList.toggle('sem-tab-active', t.dataset.sem === sem));
    semSections.forEach((s) => s.classList.toggle('sem-hidden', s.dataset.semester !== sem));
  };
  semTabs.forEach((tab) => tab.addEventListener('click', () => activateSemester(tab.dataset.sem)));
  activateSemester('1');
}
