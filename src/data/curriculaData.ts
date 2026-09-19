export interface ISubtopic {
  id: string;
  name: string;
  description: string;
}

export interface ITopic {
  id: string;
  name: string;
  description: string;
  subtopics: ISubtopic[];
}

export interface ICurriculum {
  id: string;
  careerName: string;
  domain: string;
  description: string;
  targetRole: string;
  topics: ITopic[];
}

export const STANDARD_CURRICULA: Record<string, ICurriculum> = {
  'java-software-engineer': {
    id: 'java-software-engineer',
    careerName: 'Java Software Engineer',
    domain: 'Computer Science',
    description: 'Comprehensive backend engineering mastery focusing on Java core architecture, OOP, Spring Boot microservices, and high-throughput system design.',
    targetRole: 'Java Backend Engineer',
    topics: [
      {
        id: 'java-core',
        name: 'Java',
        description: 'Core Java language fundamentals, Object-Oriented Programming, collections, concurrency, and JVM internals.',
        subtopics: [
          {
            id: 'oop',
            name: 'OOP',
            description: 'Object-Oriented Programming principles: Encapsulation, Inheritance, Polymorphism, Abstraction, Interfaces, and Composition vs Inheritance.',
          },
          {
            id: 'collections',
            name: 'Collections Framework',
            description: 'List, Set, Map, Queue implementations, internal working of HashMap, ConcurrentHashMap, and performance trade-offs.',
          },
          {
            id: 'concurrency',
            name: 'Concurrency & Multithreading',
            description: 'Thread lifecycle, synchronization, Locks, ThreadPoolExecutor, CompletableFuture, and volatile memory model.',
          },
          {
            id: 'jvm-internals',
            name: 'JVM Internals & Memory Management',
            description: 'ClassLoaders, Heap vs Stack, Garbage Collection algorithms (G1, ZGC), memory leaks, and profiling tools.',
          },
          {
            id: 'streams-lambdas',
            name: 'Exception Handling & Streams',
            description: 'Checked vs Unchecked exceptions, Functional interfaces, Lambdas, Stream API pipelines, and Optional usage.',
          },
        ],
      },
      {
        id: 'spring-boot',
        name: 'Spring Boot & Microservices',
        description: 'Enterprise backend development using Spring Boot, Spring Data JPA, security, and distributed microservices.',
        subtopics: [
          {
            id: 'spring-core',
            name: 'Dependency Injection & IoC',
            description: 'Inversion of Control container, Bean lifecycle, scopes, annotations, and autowiring mechanisms.',
          },
          {
            id: 'spring-data-jpa',
            name: 'Spring Data JPA & Hibernate',
            description: 'ORM mappings, entity relationships, lazy vs eager loading, N+1 query problem, and transactions.',
          },
          {
            id: 'rest-apis',
            name: 'RESTful API Design & Security',
            description: 'HTTP status codes, DTO mapping, input validation, JWT authentication, and OAuth2 integration.',
          },
          {
            id: 'microservices',
            name: 'Microservice Resilience & Patterns',
            description: 'Service discovery (Eureka), API gateways, circuit breaker pattern (Resilience4j), and distributed tracing.',
          },
        ],
      },
      {
        id: 'databases',
        name: 'Databases & SQL',
        description: 'Relational database design, query optimization, indexing strategies, and transactional integrity.',
        subtopics: [
          {
            id: 'sql-optimization',
            name: 'Indexing & Query Optimization',
            description: 'B-Tree indexes, composite indexes, query execution plans, JOIN strategies, and slow query profiling.',
          },
          {
            id: 'acid-transactions',
            name: 'Transactions & ACID Properties',
            description: 'Atomicity, Consistency, Isolation levels (Dirty read, Phantom read), and distributed transactions.',
          },
        ],
      },
      {
        id: 'dsa',
        name: 'Data Structures & Algorithms',
        description: 'Algorithmic efficiency, time/space complexity analysis, and problem-solving patterns in Java.',
        subtopics: [
          {
            id: 'linear-structures',
            name: 'Arrays, Strings & Linked Lists',
            description: 'Two pointers, sliding window, fast/slow pointers, and dynamic array resizing mechanisms.',
          },
          {
            id: 'trees-graphs',
            name: 'Trees & Graph Traversal',
            description: 'Binary Search Trees, DFS, BFS, Dijkstra, topological sorting, and Union-Find algorithms.',
          },
        ],
      },
    ],
  },

  'full-stack-web-developer': {
    id: 'full-stack-web-developer',
    careerName: 'Full Stack Web Developer',
    domain: 'Computer Science',
    description: 'Modern full-stack web applications spanning responsive frontend architectures, Node.js APIs, and cloud deployments.',
    targetRole: 'Full Stack Engineer',
    topics: [
      {
        id: 'frontend-eng',
        name: 'Frontend Engineering',
        description: 'Modern UI engineering with React, TypeScript, state management, and web performance optimization.',
        subtopics: [
          {
            id: 'react-fundamentals',
            name: 'React Architecture & Hooks',
            description: 'Component lifecycle, custom hooks, reconciliation algorithm, and render performance.',
          },
          {
            id: 'state-management',
            name: 'State Management & Caching',
            description: 'Context API, Redux Toolkit, React Query/TanStack Query server state, and optimistic updates.',
          },
          {
            id: 'typescript-web',
            name: 'TypeScript for Web Apps',
            description: 'Generics, union types, strict null checks, and end-to-end type safety with backend schemas.',
          },
        ],
      },
      {
        id: 'backend-eng',
        name: 'Backend Engineering',
        description: 'Scalable server architecture, Node.js runtime, asynchronous event-driven I/O, and REST/GraphQL APIs.',
        subtopics: [
          {
            id: 'nodejs-eventloop',
            name: 'Node.js & Event Loop',
            description: 'Libuv, microtasks vs macrotasks, stream processing, and cluster mode scaling.',
          },
          {
            id: 'api-architecture',
            name: 'RESTful API & Middleware',
            description: 'Authentication, error handling pipelines, rate limiting, and structured logging.',
          },
        ],
      },
      {
        id: 'databases-devops',
        name: 'Databases & DevOps',
        description: 'Database persistence with PostgreSQL/MongoDB, containerization with Docker, and CI/CD pipelines.',
        subtopics: [
          {
            id: 'db-modeling',
            name: 'Data Modeling (SQL & NoSQL)',
            description: 'Schema normalization, document database design, and indexing strategies.',
          },
          {
            id: 'docker-deployment',
            name: 'Docker & Cloud Deployment',
            description: 'Container multi-stage builds, environment isolation, and production reverse proxy setup.',
          },
        ],
      },
    ],
  },

  'data-science-ai-engineer': {
    id: 'data-science-ai-engineer',
    careerName: 'Data Science & AI Engineer',
    domain: 'Computer Science',
    description: 'Applied machine learning, statistical modeling, neural networks, and scalable data pipeline engineering.',
    targetRole: 'Data Scientist / AI Engineer',
    topics: [
      {
        id: 'math-stats',
        name: 'Statistics & Python Foundations',
        description: 'Exploratory data analysis, probability distributions, hypothesis testing, and vectorized computation.',
        subtopics: [
          {
            id: 'stats-eda',
            name: 'Probability & Inferential Statistics',
            description: 'Central Limit Theorem, p-values, confidence intervals, and parametric vs non-parametric tests.',
          },
          {
            id: 'pandas-numpy',
            name: 'Vectorized Data Processing',
            description: 'NumPy broadcasting, Pandas manipulation, time-series analysis, and memory optimization.',
          },
        ],
      },
      {
        id: 'machine-learning',
        name: 'Machine Learning Algorithms',
        description: 'Supervised and unsupervised learning, feature engineering, and model validation techniques.',
        subtopics: [
          {
            id: 'supervised-learning',
            name: 'Regression & Classification',
            description: 'Linear/Logistic regression, Decision Trees, Random Forests, XGBoost, and evaluation metrics (ROC-AUC).',
          },
          {
            id: 'unsupervised-learning',
            name: 'Clustering & Dimensionality Reduction',
            description: 'K-Means, Hierarchical clustering, PCA, t-SNE, and anomaly detection.',
          },
        ],
      },
      {
        id: 'deep-learning',
        name: 'Deep Learning & LLMs',
        description: 'Neural network architectures, transformers, prompt engineering, and model deployment.',
        subtopics: [
          {
            id: 'neural-networks',
            name: 'Neural Network Foundations',
            description: 'Backpropagation, activation functions, loss landscapes, and regularization (Dropout, BatchNorm).',
          },
          {
            id: 'nlp-transformers',
            name: 'Transformers & LLM Pipelines',
            description: 'Self-attention mechanisms, tokenization, embeddings, RAG architectures, and fine-tuning concepts.',
          },
        ],
      },
    ],
  },

  'cloud-devops-engineer': {
    id: 'cloud-devops-engineer',
    careerName: 'Cloud & DevOps Engineer',
    domain: 'Computer Science',
    description: 'Infrastructure automation, Linux internals, Kubernetes container orchestration, and continuous delivery pipelines.',
    targetRole: 'DevOps & Cloud Engineer',
    topics: [
      {
        id: 'linux-infra',
        name: 'Linux & Cloud Networking',
        description: 'Operating system processes, virtual memory, shell scripting, DNS, TCP/IP, and firewall configuration.',
        subtopics: [
          {
            id: 'linux-internals',
            name: 'Linux Administration & Shell',
            description: 'Systemd, signals, process scheduling, user permissions, and Bash automation scripts.',
          },
          {
            id: 'networking',
            name: 'Cloud Networking & Security',
            description: 'VPC design, subnets, routing tables, NAT gateways, load balancers, and SSL/TLS termination.',
          },
        ],
      },
      {
        id: 'containers-k8s',
        name: 'Docker & Kubernetes',
        description: 'Container runtimes, image optimization, multi-node cluster management, and service discovery.',
        subtopics: [
          {
            id: 'docker-mastery',
            name: 'Container Architecture & Optimization',
            description: 'Namespaces, cgroups, layered filesystem, security hardening, and Docker Compose.',
          },
          {
            id: 'k8s-orchestration',
            name: 'Kubernetes Pods, Services & Ingress',
            description: 'Deployments, ReplicaSets, StatefulSets, ConfigMaps, Secrets, and rolling updates.',
          },
        ],
      },
    ],
  },

  'mechanical-design-engineer': {
    id: 'mechanical-design-engineer',
    careerName: 'Mechanical Design Engineer',
    domain: 'Mechanical Engineering',
    description: 'Machine element design, CAD modeling, GD&T standards, thermal analysis, and finite element stress verification.',
    targetRole: 'Mechanical Design Engineer',
    topics: [
      {
        id: 'mechanics-materials',
        name: 'Engineering Mechanics & Materials',
        description: 'Stress-strain behavior, failure theories, fatigue limits, and material selection for fabrication.',
        subtopics: [
          {
            id: 'solid-mechanics',
            name: 'Strength of Materials',
            description: 'Bending moment diagrams, shear stress, torsion of shafts, and column buckling analysis.',
          },
          {
            id: 'materials-selection',
            name: 'Engineering Metallurgy & Polymers',
            description: 'Heat treatment cycles, phase diagrams, yield strengths, and corrosion resistance.',
          },
        ],
      },
      {
        id: 'cad-gdt',
        name: 'CAD & GD&T Standards',
        description: 'Parametric 3D solid modeling, assembly constraints, and Geometric Dimensioning & Tolerancing (ASME Y14.5).',
        subtopics: [
          {
            id: 'gdt-principles',
            name: 'GD&T Feature Control Frames',
            description: 'Datums, True Position, Perpendicularity, Flatness, Runout, and Maximum Material Condition (MMC).',
          },
          {
            id: 'dfm-dfa',
            name: 'Design for Manufacturing (DFM)',
            description: 'Draft angles, parting lines, sheet metal bend deductions, and tolerance stack-up analysis.',
          },
        ],
      },
    ],
  },

  'civil-structural-engineer': {
    id: 'civil-structural-engineer',
    careerName: 'Civil Structural Engineer',
    domain: 'Civil Engineering',
    description: 'Structural mechanics, reinforced concrete design, steel frame analysis, and geotechnical foundation engineering.',
    targetRole: 'Structural Engineer',
    topics: [
      {
        id: 'structural-analysis',
        name: 'Structural Analysis',
        description: 'Determinate and indeterminate structures, slope-deflection method, moment distribution, and matrix methods.',
        subtopics: [
          {
            id: 'indeterminate-analysis',
            name: 'Indeterminate Frame Analysis',
            description: 'Degree of static/kinematic indeterminacy, influence lines, and lateral load distribution.',
          },
          {
            id: 'seismic-wind',
            name: 'Earthquake & Wind Loadings',
            description: 'Response spectrum analysis, seismic base shear, ductility provisions, and IS 1893/ASCE 7 standards.',
          },
        ],
      },
      {
        id: 'rcc-steel-design',
        name: 'Concrete & Steel Design',
        description: 'Limit state design of beams, slabs, columns, footings, and bolted/welded steel connections.',
        subtopics: [
          {
            id: 'limit-state-concrete',
            name: 'Reinforced Concrete Limit State',
            description: 'Flexural strength, shear reinforcement, crack width control, and bond stress development.',
          },
          {
            id: 'steel-connections',
            name: 'Steel Member & Joint Design',
            description: 'Tension and compression members, plastic design, high-strength friction grip bolts, and weld inspections.',
          },
        ],
      },
    ],
  },

  'electronics-embedded-engineer': {
    id: 'electronics-embedded-engineer',
    careerName: 'Electronics & Embedded Systems Engineer',
    domain: 'Electronics Engineering',
    description: 'Embedded firmware in C, microcontroller architectures, communication protocols, PCB design, and IoT interfacing.',
    targetRole: 'Embedded Systems Engineer',
    topics: [
      {
        id: 'embedded-systems',
        name: 'Embedded C & Microcontrollers',
        description: 'ARM Cortex-M architecture, memory-mapped I/O, interrupt service routines, and low-power modes.',
        subtopics: [
          {
            id: 'embedded-c-baremetal',
            name: 'Bare-Metal C Programming',
            description: 'Bitwise manipulation, volatile qualifiers, pointers to hardware registers, and bootloader operation.',
          },
          {
            id: 'comm-protocols',
            name: 'UART, SPI & I2C Protocols',
            description: 'Timing diagrams, master-slave handshakes, bus arbitration, clock stretching, and baud rate calibration.',
          },
        ],
      },
      {
        id: 'digital-circuit-pcb',
        name: 'Digital Electronics & PCB Design',
        description: 'Sequential logic, timing closure, signal integrity, and multi-layer PCB schematic/routing best practices.',
        subtopics: [
          {
            id: 'sequential-logic',
            name: 'Flip-Flops, Counters & State Machines',
            description: 'Setup and hold times, metastabilities, Mealy vs Moore state machines, and FPGA basics.',
          },
          {
            id: 'pcb-signal-integrity',
            name: 'High-Speed PCB Layout',
            description: 'Decoupling capacitor placement, impedance matching, ground planes, and differential pair routing.',
          },
        ],
      },
    ],
  },

  'corporate-finance-analyst': {
    id: 'corporate-finance-analyst',
    careerName: 'Corporate Finance & Banking Analyst',
    domain: 'Commerce & Finance',
    description: 'Financial statement analysis, Discounted Cash Flow (DCF) valuation, capital budgeting, and M&A modeling.',
    targetRole: 'Financial Analyst / Investment Banker',
    topics: [
      {
        id: 'financial-accounting',
        name: 'Financial Accounting & Reporting',
        description: 'Balance sheets, income statements, cash flow statements, working capital management, and revenue recognition.',
        subtopics: [
          {
            id: 'three-statement-modeling',
            name: 'Three-Statement Financial Modeling',
            description: 'Linking net income to cash flow, working capital schedules, depreciation schedules, and debt revolvers.',
          },
          {
            id: 'ratio-analysis',
            name: 'Financial Ratio & Liquidity Analysis',
            description: 'DuPont analysis, current ratio, quick ratio, debt-to-equity, EBITDA margins, and interest coverage.',
          },
        ],
      },
      {
        id: 'valuation-corporate-finance',
        name: 'Valuation & Corporate Finance',
        description: 'Discounted Cash Flow, WACC calculations, Comparable Company Analysis (Comps), and Precedent Transactions.',
        subtopics: [
          {
            id: 'dcf-wacc',
            name: 'Discounted Cash Flow (DCF) & WACC',
            description: 'Cost of equity via CAPM, beta unlevering/relevering, terminal value multiples, and sensitivity tables.',
          },
          {
            id: 'capital-budgeting',
            name: 'Capital Budgeting & M&A',
            description: 'NPV, IRR, Payback Period, accretion/dilution analysis, and synergy modeling.',
          },
        ],
      },
    ],
  },

  'digital-marketing-growth-lead': {
    id: 'digital-marketing-growth-lead',
    careerName: 'Digital Marketing & Growth Lead',
    domain: 'Management & Marketing',
    description: 'Performance marketing, search engine optimization (SEO), conversion rate optimization (CRO), and attribution modeling.',
    targetRole: 'Growth Marketing Manager',
    topics: [
      {
        id: 'seo-content',
        name: 'Search Engine Optimization & Content',
        description: 'Technical SEO, crawling, indexing, keyword intent clustering, on-page optimization, and high-quality backlink acquisition.',
        subtopics: [
          {
            id: 'technical-seo',
            name: 'Technical SEO & Core Web Vitals',
            description: 'Robots.txt, XML sitemaps, canonical tags, LCP, INP, CLS optimization, and structured schema markup.',
          },
          {
            id: 'content-strategy',
            name: 'Content Marketing & Search Intent',
            description: 'Informational vs transactional intent, topic clusters, content depth, and authority building.',
          },
        ],
      },
      {
        id: 'performance-analytics',
        name: 'Performance Marketing & Analytics',
        description: 'PPC campaigns, ad auction dynamics, customer acquisition cost (CAC), lifetime value (LTV), and Google Analytics 4.',
        subtopics: [
          {
            id: 'paid-acquisition',
            name: 'Paid Ads & Funnel Optimization',
            description: 'Google Search ads, Meta ads targeting, A/B ad creative testing, and multi-touch attribution models.',
          },
          {
            id: 'growth-metrics',
            name: 'Growth Metrics & Unit Economics',
            description: 'LTV:CAC ratio, churn rate calculation, cohort retention curves, and viral coefficient (K-factor).',
          },
        ],
      },
    ],
  },
};

/**
 * Resolve standard curriculum by Career name or ID with fuzzy matching
 */
export function resolveCurriculum(careerQuery?: string): ICurriculum {
  if (!careerQuery) {
    return STANDARD_CURRICULA['java-software-engineer'];
  }

  const queryLower = careerQuery.toLowerCase().trim();

  // 1. Direct ID match
  if (STANDARD_CURRICULA[queryLower]) {
    return STANDARD_CURRICULA[queryLower];
  }

  // 2. Exact or partial title match
  for (const curriculum of Object.values(STANDARD_CURRICULA)) {
    if (curriculum.careerName.toLowerCase() === queryLower) {
      return curriculum;
    }
  }

  // 3. Keyword heuristic match
  if (queryLower.includes('java')) return STANDARD_CURRICULA['java-software-engineer'];
  if (queryLower.includes('full stack') || queryLower.includes('web') || queryLower.includes('frontend') || queryLower.includes('backend') || queryLower.includes('software')) {
    return STANDARD_CURRICULA['full-stack-web-developer'];
  }
  if (queryLower.includes('data') || queryLower.includes('ai') || queryLower.includes('machine learning') || queryLower.includes('deep learning')) {
    return STANDARD_CURRICULA['data-science-ai-engineer'];
  }
  if (queryLower.includes('devops') || queryLower.includes('cloud') || queryLower.includes('k8s') || queryLower.includes('docker')) {
    return STANDARD_CURRICULA['cloud-devops-engineer'];
  }
  if (queryLower.includes('mech') || queryLower.includes('cad') || queryLower.includes('automobile')) {
    return STANDARD_CURRICULA['mechanical-design-engineer'];
  }
  if (queryLower.includes('civil') || queryLower.includes('structur') || queryLower.includes('construct')) {
    return STANDARD_CURRICULA['civil-structural-engineer'];
  }
  if (queryLower.includes('elect') || queryLower.includes('embed') || queryLower.includes('iot') || queryLower.includes('vlsi')) {
    return STANDARD_CURRICULA['electronics-embedded-engineer'];
  }
  if (queryLower.includes('finan') || queryLower.includes('bank') || queryLower.includes('invest') || queryLower.includes('account') || queryLower.includes('tax')) {
    return STANDARD_CURRICULA['corporate-finance-analyst'];
  }
  if (queryLower.includes('market') || queryLower.includes('seo') || queryLower.includes('growth') || queryLower.includes('sales')) {
    return STANDARD_CURRICULA['digital-marketing-growth-lead'];
  }

  // Default fallback
  return STANDARD_CURRICULA['java-software-engineer'];
}
