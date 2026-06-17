/* ============================================================
   paulasilva-ms playbook, chapter 01 content
   v1.7.0, EN + PT-BR + ES
   ============================================================ */

window.PLAYBOOK_CHAPTER_01 = {

  /* ----- ENGLISH ----- */
  'en': {
    pageTitle: 'Chapter 01, Cloud and Infra Foundation, Playbook',
    metaDescription: 'Network, identity, runtime substrate, observability. The contract every layer above depends on.',
    breadcrumbCurrent: 'Chapter 01, Cloud and Infra Foundation',
    eyebrow: 'Foundation Layer',
    title: 'Cloud and Infra Foundation.',
    lead: 'Network, identity, runtime substrate, observability. The contract every layer above depends on.',
    sections: {
      whyFoundation: {
        h2: 'Why foundation comes first',
        p1: 'Every AI-native pilot eventually meets the same wall. Networking that was not designed, identity that was bolted on, observability that arrived late. The team renames the project, builds again, and the new pilot dies in the same way.',
        p2: 'This chapter is opinionated on purpose. The foundation layer is the smallest set of cloud primitives that must be in place before any agent, model, or pipeline gets shipped. Without these, every higher layer pays interest on debt it cannot retire.',
        calloutText: 'The foundation layer is the set of cloud primitives that bind networking, identity, runtime, and observability into a single auditable surface. It is the boundary between the cloud you rent and the platform you operate.'
      },
      threeLayers: {
        h2: 'The three layers of foundation',
        p1: 'Foundation itself decomposes into three sub-layers, each with a clear contract and a clear consumer. The diagram below shows the dependency direction. Network and identity at the bottom, runtime substrate in the middle, observability at the top. Reverse the arrows and the abstraction breaks.',
        layer1H3: 'Layer 1, network and identity',
        layer1P: 'Every workload terminates TLS at one of two ingress points. Every identity comes from a single root of trust. Secrets do not exist outside the secret store. If any of these three are violated, the rest of the stack cannot defend itself.',
        layer2H3: 'Layer 2, runtime substrate',
        layer2P: 'The runtime substrate is the contract between the cloud and the platform. Compute, container runtime, packaging, and image policy. A change here is a change for every consumer above. Move slowly, version explicitly, deprecate kindly.'
      },
      bootstrap: {
        h2: 'Bootstrapping a foundation',
        p1: 'A foundation bootstrap is five steps, in order. Each step produces a single artifact that the next step consumes. Skipping a step does not save time, it only moves the failure to a worse moment.',
        p2: 'Notice three things. First, every step ends in OK or stops. Second, the audit hash at the end commits the bootstrap to the IaC change record. Third, the script is idempotent, you can rerun without breaking what is already in place.'
      },
      checklist: {
        h2: 'Production checklist',
        p1: 'Twelve checks. If any is red, the workload does not enter production. The list is meant to be uncomfortable, that is the point.',
        items: [
          'Private networking enforced, no public endpoints on workload subnets.',
          'Single identity provider, no local users on compute, no static keys.',
          'TLS terminated at ingress, internal mTLS where applicable.',
          'Secrets in secret store, no plaintext in repos, no plaintext in env files at rest.',
          'Container runtime patched within agreed SLA, image policy signed.',
          'Image registry private, immutable tags, vulnerability scan on push.',
          'Logs structured, retained per policy, access audited.',
          'Metrics with bounded cardinality, no high-cardinality labels in counters.',
          'Traces enabled at every external boundary.',
          'SLOs declared per workload, error budget visible to owner.',
          'IaC in version control, plans reviewed, applies authenticated.',
          'Rollback rehearsed in the last 30 days.'
        ]
      },
      mondayMorning: {
        h2: 'Monday morning',
        p1: 'Five concrete actions to take this week. None requires a project, a budget, or a green light.',
        items: [
          'Pick one workload. Write down its identity provider, its ingress path, and its log destination on a single page. If any field is empty, that is your first ticket.',
          'Run your IaC plan in CI on every PR, even if it does not apply yet. Make the diff visible to reviewers.',
          'Add structured logging at every external boundary in one workload. Confirm that trace IDs propagate through.',
          'Pick one secret that is currently long-lived and replace it with a short-lived workload identity.',
          'Define one SLO for one workload, write down the error budget, and post the dashboard link where the team will see it daily.'
        ]
      },
      references: {
        h2: 'References',
        p1: 'Selected reading on cloud foundation patterns, primary sources only.',
        items: [
          { url: 'https://cloud.google.com/architecture/framework', linkText: 'Google Cloud Architecture Framework', tail: ', the closest thing to a single-document source on cloud-foundation discipline.' },
          { url: 'https://learn.microsoft.com/azure/cloud-adoption-framework/', linkText: 'Microsoft Cloud Adoption Framework', tail: ', the canonical reference for landing zones and identity patterns.' },
          { url: 'https://aws.amazon.com/architecture/well-architected/', linkText: 'AWS Well-Architected Framework', tail: ', the operational lens, particularly the Reliability and Security pillars.' },
          { url: 'https://opentelemetry.io/docs/specs/otel/', linkText: 'OpenTelemetry specification', tail: ', the contract for traces, metrics, and logs across vendors.' },
          { url: 'https://sre.google/sre-book/service-level-objectives/', linkText: 'Google SRE book, Service Level Objectives', tail: ', the SLO definition the rest of the industry copied.' }
        ]
      }
    },
    pagenav: {
      prev: { num: '00', title: 'Chapter 00, Introduction',  href: 'chapter-00-introduction.html' },
      next: { num: '02', title: 'Chapter 02, Platform Engineering', href: 'chapter-02-platform.html' }
    }
  },

  /* ----- PORTUGUÊS BRASIL ----- */
  'pt-br': {
    pageTitle: 'Capítulo 01, Fundação de Cloud e Infra, Playbook',
    metaDescription: 'Rede, identidade, substrato de runtime, observabilidade. O contrato do qual cada camada acima depende.',
    breadcrumbCurrent: 'Capítulo 01, Fundação de Cloud e Infra',
    eyebrow: 'Camada de Fundação',
    title: 'Fundação de Cloud e Infra.',
    lead: 'Rede, identidade, substrato de runtime, observabilidade. O contrato do qual cada camada acima depende.',
    sections: {
      whyFoundation: {
        h2: 'Por que fundação vem primeiro',
        p1: 'Todo piloto AI-native eventualmente bate no mesmo muro. Rede que não foi desenhada, identidade que foi parafusada depois, observabilidade que chegou tarde. O time renomeia o projeto, constrói de novo, e o novo piloto morre da mesma forma.',
        p2: 'Este capítulo é opinativo de propósito. A camada de fundação é o menor conjunto de primitivas de cloud que precisa estar no lugar antes de qualquer agente, modelo ou pipeline ser entregue. Sem isso, cada camada acima paga juros sobre uma dívida que não consegue quitar.',
        calloutText: 'A camada de fundação é o conjunto de primitivas de cloud que liga rede, identidade, runtime e observabilidade em uma única superfície auditável. É a fronteira entre a cloud que você aluga e a plataforma que você opera.'
      },
      threeLayers: {
        h2: 'As três camadas da fundação',
        p1: 'A própria fundação se decompõe em três sub-camadas, cada uma com contrato claro e consumidor claro. O diagrama abaixo mostra a direção da dependência. Rede e identidade na base, substrato de runtime no meio, observabilidade no topo. Inverta as setas e a abstração quebra.',
        layer1H3: 'Camada 1, rede e identidade',
        layer1P: 'Toda carga termina TLS em um de dois pontos de ingresso. Toda identidade vem de uma única raiz de confiança. Segredos não existem fora do cofre de segredos. Se qualquer um desses três for violado, o resto do stack não consegue se defender.',
        layer2H3: 'Camada 2, substrato de runtime',
        layer2P: 'O substrato de runtime é o contrato entre a cloud e a plataforma. Compute, runtime de container, empacotamento e política de imagem. Uma mudança aqui é uma mudança para todo consumidor acima. Mova devagar, versione explicitamente, deprecie com gentileza.'
      },
      bootstrap: {
        h2: 'Inicializando uma fundação',
        p1: 'Um bootstrap de fundação são cinco passos, em ordem. Cada passo produz um único artefato que o próximo consome. Pular um passo não economiza tempo, só move a falha para um momento pior.',
        p2: 'Note três coisas. Primeiro, cada passo termina em OK ou para. Segundo, o hash de auditoria no final compromete o bootstrap ao registro de mudança de IaC. Terceiro, o script é idempotente, você pode rodar de novo sem quebrar o que já está no lugar.'
      },
      checklist: {
        h2: 'Checklist de produção',
        p1: 'Doze checks. Se algum estiver vermelho, a carga não entra em produção. A lista é desconfortável de propósito, esse é o ponto.',
        items: [
          'Rede privada obrigatória, sem endpoints públicos em subnets de carga.',
          'Provedor de identidade único, sem usuários locais em compute, sem chaves estáticas.',
          'TLS terminado no ingresso, mTLS interno onde aplicável.',
          'Segredos no cofre de segredos, sem texto plano em repos, sem texto plano em arquivos env em repouso.',
          'Runtime de container atualizado dentro do SLA acordado, política de imagem assinada.',
          'Registro de imagens privado, tags imutáveis, scan de vulnerabilidade no push.',
          'Logs estruturados, retidos conforme política, acesso auditado.',
          'Métricas com cardinalidade limitada, sem labels de alta cardinalidade em counters.',
          'Traces ativados em cada fronteira externa.',
          'SLOs declarados por carga, orçamento de erro visível ao dono.',
          'IaC em controle de versão, plans revisados, applies autenticados.',
          'Rollback ensaiado nos últimos 30 dias.'
        ]
      },
      mondayMorning: {
        h2: 'Segunda-feira de manhã',
        p1: 'Cinco ações concretas para tomar nesta semana. Nenhuma exige projeto, orçamento ou luz verde.',
        items: [
          'Escolha uma carga. Anote em uma página o provedor de identidade dela, o caminho de ingresso e o destino dos logs. Se algum campo estiver vazio, esse é seu primeiro ticket.',
          'Rode seu IaC plan no CI em cada PR, mesmo que ainda não apply. Torne o diff visível para revisores.',
          'Adicione logging estruturado em cada fronteira externa de uma carga. Confirme que trace IDs se propagam.',
          'Escolha um segredo que é atualmente de longa duração e substitua por uma identidade de carga de curta duração.',
          'Defina um SLO para uma carga, anote o orçamento de erro e poste o link do dashboard onde o time vai ver diariamente.'
        ]
      },
      references: {
        h2: 'Referências',
        p1: 'Leitura selecionada sobre padrões de fundação de cloud, apenas fontes primárias.',
        items: [
          { url: 'https://cloud.google.com/architecture/framework', linkText: 'Google Cloud Architecture Framework', tail: ', a coisa mais próxima de uma fonte única sobre disciplina de fundação de cloud.' },
          { url: 'https://learn.microsoft.com/azure/cloud-adoption-framework/', linkText: 'Microsoft Cloud Adoption Framework', tail: ', a referência canônica para landing zones e padrões de identidade.' },
          { url: 'https://aws.amazon.com/architecture/well-architected/', linkText: 'AWS Well-Architected Framework', tail: ', a lente operacional, particularmente os pilares de Confiabilidade e Segurança.' },
          { url: 'https://opentelemetry.io/docs/specs/otel/', linkText: 'Especificação OpenTelemetry', tail: ', o contrato para traces, métricas e logs entre fornecedores.' },
          { url: 'https://sre.google/sre-book/service-level-objectives/', linkText: 'Livro SRE do Google, Service Level Objectives', tail: ', a definição de SLO que o resto da indústria copiou.' }
        ]
      }
    },
    pagenav: {
      prev: { num: '00', title: 'Capítulo 00, Introdução',  href: 'chapter-00-introduction.html' },
      next: { num: '02', title: 'Capítulo 02, Platform Engineering', href: 'chapter-02-platform.html' }
    }
  },

  /* ----- ESPAÑOL ----- */
  'es': {
    pageTitle: 'Capítulo 01, Fundación de Cloud e Infra, Playbook',
    metaDescription: 'Red, identidad, sustrato de runtime, observabilidad. El contrato del que depende cada capa de arriba.',
    breadcrumbCurrent: 'Capítulo 01, Fundación de Cloud e Infra',
    eyebrow: 'Capa de Fundación',
    title: 'Fundación de Cloud e Infra.',
    lead: 'Red, identidad, sustrato de runtime, observabilidad. El contrato del que depende cada capa de arriba.',
    sections: {
      whyFoundation: {
        h2: 'Por qué la fundación va primero',
        p1: 'Todo piloto AI-native eventualmente choca con el mismo muro. Red que no fue diseñada, identidad atornillada después, observabilidad que llegó tarde. El equipo renombra el proyecto, construye otra vez, y el nuevo piloto muere de la misma forma.',
        p2: 'Este capítulo es opinado a propósito. La capa de fundación es el conjunto mínimo de primitivas de cloud que debe estar en su lugar antes de que cualquier agente, modelo o pipeline se entregue. Sin esto, cada capa de arriba paga intereses sobre una deuda que no puede saldar.',
        calloutText: 'La capa de fundación es el conjunto de primitivas de cloud que une red, identidad, runtime y observabilidad en una sola superficie auditable. Es la frontera entre la cloud que rentas y la plataforma que operas.'
      },
      threeLayers: {
        h2: 'Las tres capas de la fundación',
        p1: 'La fundación misma se descompone en tres sub-capas, cada una con un contrato claro y un consumidor claro. El diagrama abajo muestra la dirección de la dependencia. Red e identidad en la base, sustrato de runtime en el medio, observabilidad arriba. Invierte las flechas y la abstracción se rompe.',
        layer1H3: 'Capa 1, red e identidad',
        layer1P: 'Toda carga termina TLS en uno de dos puntos de ingreso. Toda identidad viene de una sola raíz de confianza. Los secretos no existen fuera del almacén de secretos. Si cualquiera de estos tres se viola, el resto del stack no puede defenderse.',
        layer2H3: 'Capa 2, sustrato de runtime',
        layer2P: 'El sustrato de runtime es el contrato entre la cloud y la plataforma. Compute, runtime de contenedor, empaquetado y política de imagen. Un cambio aquí es un cambio para todo consumidor arriba. Muévete despacio, versiona explícitamente, deprecia con gentileza.'
      },
      bootstrap: {
        h2: 'Iniciando una fundación',
        p1: 'Un bootstrap de fundación son cinco pasos, en orden. Cada paso produce un único artefacto que el siguiente consume. Saltarse un paso no ahorra tiempo, solo mueve la falla a un momento peor.',
        p2: 'Nota tres cosas. Primero, cada paso termina en OK o se detiene. Segundo, el hash de auditoría al final compromete el bootstrap al registro de cambio de IaC. Tercero, el script es idempotente, puedes correrlo de nuevo sin romper lo que ya está.'
      },
      checklist: {
        h2: 'Checklist de producción',
        p1: 'Doce checks. Si alguno está rojo, la carga no entra en producción. La lista es incómoda a propósito, ese es el punto.',
        items: [
          'Red privada obligatoria, sin endpoints públicos en subnets de carga.',
          'Proveedor de identidad único, sin usuarios locales en compute, sin claves estáticas.',
          'TLS terminado en el ingreso, mTLS interno donde aplique.',
          'Secretos en almacén de secretos, sin texto plano en repos, sin texto plano en archivos env en reposo.',
          'Runtime de contenedor parchado dentro del SLA acordado, política de imagen firmada.',
          'Registro de imágenes privado, tags inmutables, escaneo de vulnerabilidades en push.',
          'Logs estructurados, retenidos por política, acceso auditado.',
          'Métricas con cardinalidad acotada, sin labels de alta cardinalidad en contadores.',
          'Traces habilitados en cada frontera externa.',
          'SLOs declarados por carga, presupuesto de error visible al dueño.',
          'IaC en control de versión, planes revisados, applies autenticados.',
          'Rollback ensayado en los últimos 30 días.'
        ]
      },
      mondayMorning: {
        h2: 'Lunes por la mañana',
        p1: 'Cinco acciones concretas para tomar esta semana. Ninguna requiere proyecto, presupuesto o luz verde.',
        items: [
          'Elige una carga. Anota en una página su proveedor de identidad, su ruta de ingreso y su destino de logs. Si algún campo está vacío, ese es tu primer ticket.',
          'Ejecuta tu IaC plan en CI en cada PR, aunque aún no hagas apply. Haz visible el diff a los revisores.',
          'Añade logging estructurado en cada frontera externa de una carga. Confirma que los trace IDs se propagan.',
          'Elige un secreto que actualmente es de larga duración y reemplázalo con una identidad de carga de corta duración.',
          'Define un SLO para una carga, anota el presupuesto de error, y publica el enlace del dashboard donde el equipo lo verá a diario.'
        ]
      },
      references: {
        h2: 'Referencias',
        p1: 'Lectura seleccionada sobre patrones de fundación de cloud, solo fuentes primarias.',
        items: [
          { url: 'https://cloud.google.com/architecture/framework', linkText: 'Google Cloud Architecture Framework', tail: ', lo más cercano a una fuente única sobre disciplina de fundación de cloud.' },
          { url: 'https://learn.microsoft.com/azure/cloud-adoption-framework/', linkText: 'Microsoft Cloud Adoption Framework', tail: ', la referencia canónica para landing zones y patrones de identidad.' },
          { url: 'https://aws.amazon.com/architecture/well-architected/', linkText: 'AWS Well-Architected Framework', tail: ', el lente operacional, particularmente los pilares de Confiabilidad y Seguridad.' },
          { url: 'https://opentelemetry.io/docs/specs/otel/', linkText: 'Especificación OpenTelemetry', tail: ', el contrato para traces, métricas y logs entre proveedores.' },
          { url: 'https://sre.google/sre-book/service-level-objectives/', linkText: 'Libro SRE de Google, Service Level Objectives', tail: ', la definición de SLO que el resto de la industria copió.' }
        ]
      }
    },
    pagenav: {
      prev: { num: '00', title: 'Capítulo 00, Introducción',  href: 'chapter-00-introduction.html' },
      next: { num: '02', title: 'Capítulo 02, Platform Engineering', href: 'chapter-02-platform.html' }
    }
  }
};
