/* ============================================================
   paulasilva-ms playbook, UI strings (chrome, modals, nav)
   v1.7.0, EN + PT-BR + ES
   Identity-locked strings (Paula Silva, Software Global Black Belt,
   tagline, paulasilva@microsoft.com) are NOT in this file.
   They stay hardcoded EN inside the HTML.
   ============================================================ */

window.PLAYBOOK_UI = {

  /* ----- ENGLISH ----- */
  'en': {
    chrome: {
      searchAria: 'Search', searchTitle: 'Search the playbook',
      themeAria: 'Toggle theme', themeTitle: 'Toggle theme',
      langAria: 'Choose language'
    },
    breadcrumb: { home: 'Home' },
    toc: { ariaLabel: 'Playbook navigation', label: 'Playbook' },
    onpage: { ariaLabel: 'On this page', label: 'On this page' },
    pagenav: { navAria: 'Chapter navigation', previous: 'Previous', next: 'Next' },
    search: {
      modalAria: 'Search the playbook',
      placeholder: 'Search the playbook...',
      ariaLabel: 'Search the playbook',
      esc: 'ESC', navigate: 'navigate', open: 'open', close: 'close',
      noResults: 'No results.'
    },
    callouts: {
      readingTips: 'Reading tips',
      keyboardShortcuts: 'Keyboard shortcuts',
      keyboardBody: 'Press <code>/</code> to search. Use <code>j</code> and <code>k</code> to move between chapters. Press <code>t</code> to toggle theme. Press <code>g</code> to go to top.',
      definition: 'Definition'
    },
    diagram: {
      dependsOn: 'DEPENDS ON',
      caption01: 'Foundation in three sub-layers, dependency direction shown'
    }
  },

  /* ----- PORTUGUÊS BRASIL ----- */
  'pt-br': {
    chrome: {
      searchAria: 'Buscar', searchTitle: 'Buscar no playbook',
      themeAria: 'Alternar tema', themeTitle: 'Alternar tema',
      langAria: 'Escolher idioma'
    },
    breadcrumb: { home: 'Início' },
    toc: { ariaLabel: 'Navegação do playbook', label: 'Playbook' },
    onpage: { ariaLabel: 'Nesta página', label: 'Nesta página' },
    pagenav: { navAria: 'Navegação de capítulos', previous: 'Anterior', next: 'Próximo' },
    search: {
      modalAria: 'Buscar no playbook',
      placeholder: 'Buscar no playbook...',
      ariaLabel: 'Buscar no playbook',
      esc: 'ESC', navigate: 'navegar', open: 'abrir', close: 'fechar',
      noResults: 'Sem resultados.'
    },
    callouts: {
      readingTips: 'Dicas de leitura',
      keyboardShortcuts: 'Atalhos de teclado',
      keyboardBody: 'Aperte <code>/</code> para buscar. Use <code>j</code> e <code>k</code> para mover entre capítulos. Aperte <code>t</code> para alternar tema. Aperte <code>g</code> para ir ao topo.',
      definition: 'Definição'
    },
    diagram: {
      dependsOn: 'DEPENDE DE',
      caption01: 'Fundação em três sub-camadas, direção de dependência mostrada'
    }
  },

  /* ----- ESPAÑOL ----- */
  'es': {
    chrome: {
      searchAria: 'Buscar', searchTitle: 'Buscar en el playbook',
      themeAria: 'Cambiar tema', themeTitle: 'Cambiar tema',
      langAria: 'Elegir idioma'
    },
    breadcrumb: { home: 'Inicio' },
    toc: { ariaLabel: 'Navegación del playbook', label: 'Playbook' },
    onpage: { ariaLabel: 'En esta página', label: 'En esta página' },
    pagenav: { navAria: 'Navegación de capítulos', previous: 'Anterior', next: 'Siguiente' },
    search: {
      modalAria: 'Buscar en el playbook',
      placeholder: 'Buscar en el playbook...',
      ariaLabel: 'Buscar en el playbook',
      esc: 'ESC', navigate: 'navegar', open: 'abrir', close: 'cerrar',
      noResults: 'Sin resultados.'
    },
    callouts: {
      readingTips: 'Consejos de lectura',
      keyboardShortcuts: 'Atajos de teclado',
      keyboardBody: 'Presiona <code>/</code> para buscar. Usa <code>j</code> y <code>k</code> para moverte entre capítulos. Presiona <code>t</code> para cambiar tema. Presiona <code>g</code> para ir al inicio.',
      definition: 'Definición'
    },
    diagram: {
      dependsOn: 'DEPENDE DE',
      caption01: 'Fundación en tres sub-capas, dirección de dependencia mostrada'
    }
  }
};
