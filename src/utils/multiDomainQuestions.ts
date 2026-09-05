export interface QuestionSeedItem {
  field: string;
  topic: string;
  subtopic?: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  interviewType: 'Technical' | 'HR' | 'Domain' | 'Scenario';
  tags: string[];
  keywords: string[];
  expectedDuration: number;
  metadata: {
    concepts: string[];
    scoreWeight: number;
    estimatedAnswerTime: string;
    isOriginal: boolean;
  };
}

export const multiDomainQuestions: QuestionSeedItem[] = [
  // ==========================================
  // MECHANICAL ENGINEERING
  // ==========================================
  {
    field: 'Mechanical Engineering',
    topic: 'CAD & Design',
    subtopic: 'GD&T',
    question: 'What is Geometric Dimensioning and Tolerancing (GD&T)? Explain the concept of Maximum Material Condition (MMC) and its engineering purpose.',
    answer: 'GD&T is a symbolic language used on engineering drawings to explicitly define allowable variation in geometry rather than just linear dimensions. Maximum Material Condition (MMC) refers to the state of a manufactured part feature where it contains the maximum amount of material within stated tolerance limits (e.g., smallest hole diameter or largest shaft diameter). Designing with MMC allows bonus tolerances during manufacturing when actual features deviate from MMC, reducing machining scrap while guaranteeing functional assembly.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['mechanical', 'cad', 'gd&t', 'tolerance', 'manufacturing'],
    keywords: ['geometric dimensioning', 'tolerancing', 'maximum material condition', 'mmc', 'datum', 'bonus tolerance', 'shaft', 'hole', 'assembly'],
    expectedDuration: 120,
    metadata: {
      concepts: ['GD&T Principles', 'Maximum Material Condition (MMC)', 'Tolerance Stacks'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Thermodynamics',
    subtopic: 'Power Cycles',
    question: 'Explain the working principle of the Rankine cycle and how reheat and regeneration improve thermal efficiency.',
    answer: 'The Rankine cycle is the idealized thermodynamic cycle of heat engine systems converting thermal energy into mechanical work using a working fluid (typically water/steam). It consists of 4 processes: isentropic pumping, constant pressure heat addition in boiler, isentropic expansion in turbine, and constant pressure condensation. Reheating steam after partial expansion prevents moisture formation in low-pressure turbine blades and increases mean heat addition temperature. Regeneration bleeds turbine steam to preheat boiler feed water, reducing external fuel requirements and raising overall Carnot efficiency.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['mechanical', 'thermodynamics', 'rankine cycle', 'thermal efficiency', 'power plants'],
    keywords: ['rankine cycle', 'boiler', 'turbine', 'condenser', 'pump', 'reheat', 'regeneration', 'thermal efficiency', 'isentropic expansion'],
    expectedDuration: 150,
    metadata: {
      concepts: ['Thermodynamic Cycles', 'Carnot Principles', 'Power Plant Operations'],
      scoreWeight: 9,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Materials & Metallurgy',
    subtopic: 'Stress-Strain',
    question: 'Describe the stress-strain curve for mild steel, identifying the proportional limit, yield point, ultimate tensile strength, and necking behavior.',
    answer: 'Under uniaxial tensile testing, mild steel begins with a linear elastic deformation region obeying Hooke\'s law up to the proportional limit. Immediately beyond this, it reaches the upper and lower yield points where plastic slip begins without significant stress increase. Work-hardening follows until the curve reaches Ultimate Tensile Strength (UTS), the maximum engineering stress the material withstands. Past UTS, localized cross-sectional reduction (necking) initiates until ductile fracture occurs at the breaking point.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['mechanical', 'materials', 'stress-strain', 'metallurgy', 'mild steel'],
    keywords: ['stress-strain curve', 'hooke\'s law', 'elastic limit', 'yield point', 'ultimate tensile strength', 'necking', 'plastic deformation', 'ductility'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Tensile Mechanics', 'Material Properties', 'Deformation Behavior'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Manufacturing Processes',
    subtopic: 'CNC & Machining',
    question: 'What are the main differences between conventional milling and climb (down) milling? When should you select climb milling?',
    answer: 'In conventional (up) milling, the cutter rotates against the direction of feed; chips start at zero thickness and increase to maximum, causing high friction and tool rubbing before cutting begins. In climb (down) milling, the cutter rotates in the direction of feed, so chip thickness starts at maximum and decreases to zero. Climb milling produces superior surface finishes, generates lower heat at the cutting edge, reduces work hardening, and requires less tool clamping force. It is preferred for finishing operations and CNC machining where backlash eliminators are present.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['mechanical', 'manufacturing', 'milling', 'machining', 'cnc'],
    keywords: ['climb milling', 'conventional milling', 'up milling', 'down milling', 'chip thickness', 'surface finish', 'tool life', 'backlash'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Machining Dynamics', 'Tool Wear Management', 'Surface Integrity'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Machine Design',
    subtopic: 'Failure Theories',
    question: 'Compare the Maximum Shear Stress Theory (Tresca) and Distortion Energy Theory (von Mises). Which is more conservative for ductile metals?',
    answer: 'The Tresca theory states that yielding occurs when the maximum shear stress in a multiaxial stress state reaches the shear yield stress in simple tension. Von Mises theory asserts yielding begins when distortion energy per unit volume equals that in uniaxial tension. Tresca represents a regular hexagon in principal stress space, while von Mises forms an ellipse enclosing the hexagon. Therefore, Tresca is strictly more conservative by approximately 15%, making it popular in high-safety structural codes, while von Mises provides higher experimental accuracy for ductile metals.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['mechanical', 'machine design', 'failure theory', 'tresca', 'von mises'],
    keywords: ['tresca', 'von mises', 'distortion energy', 'maximum shear stress', 'yielding', 'ductile materials', 'factor of safety', 'principal stress'],
    expectedDuration: 150,
    metadata: {
      concepts: ['Mechanics of Materials', 'Yield Criteria', 'Machine Component Design'],
      scoreWeight: 9,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // CIVIL ENGINEERING
  // ==========================================
  {
    field: 'Civil Engineering',
    topic: 'Structural Mechanics',
    subtopic: 'Bending & Shear',
    question: 'Explain the relationship between load, shear force, and bending moment in beams. Draw the inference for a simply supported beam with a central point load.',
    answer: 'The rate of change of shear force equals the negative distributed load (dVar/dx = -w), and the rate of change of bending moment equals the shear force (dM/dx = V). At points where shear force changes sign or crosses zero, the bending moment attains an extreme (maximum) value. For a simply supported beam with a central point load P, the shear diagram is a constant +P/2 from the left support to center, stepping down to -P/2 to the right support. The bending moment diagram is triangular, starting at 0 at both pinned supports and peaking at PL/4 directly under the load.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['civil', 'structures', 'shear force', 'bending moment', 'beams'],
    keywords: ['shear force', 'bending moment', 'point load', 'simply supported', 'differential relation', 'equilibrium', 'structural analysis'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Beam Equilibrium', 'Shear & Moment Relations', 'Structural Diagnostics'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Civil Engineering',
    topic: 'Concrete Technology',
    subtopic: 'Mix Design & Curing',
    question: 'What is the role of the water-cement ratio in concrete, and what are the consequences of adding excess water on site?',
    answer: 'According to Abrams\' Law, the compressive strength of fully compacted concrete is inversely proportional to the water-cement ratio for workable mixes. Adding excess water creates temporary ease in pouring (slump), but as free water bleeds to the surface and evaporates, it leaves extensive capillary voids, drastically reducing compressive strength, increasing permeability, accelerating drying shrinkage cracking, and lowering resistance to chemical attack and freeze-thaw cycles.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['civil', 'concrete', 'water-cement ratio', 'mix design', 'durability'],
    keywords: ['water-cement ratio', 'abrams law', 'compressive strength', 'slump', 'capillary voids', 'shrinkage cracking', 'permeability', 'hydration'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Concrete Hydration', 'Porosity & Strength', 'Field Quality Control'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Civil Engineering',
    topic: 'Geotechnical Engineering',
    subtopic: 'Soil Mechanics & Foundations',
    question: 'What is soil consolidation, and how does it differ from soil compaction?',
    answer: 'Compaction is an artificial, instantaneous mechanical process that increases soil dry density by expelling pore air using rollers, rammers, or vibrators on unsaturated soils. In contrast, consolidation is a natural, time-dependent process occurring in saturated fine-grained soils (clays) where sustained structural loads cause pore water to gradually dissipate, transferring effective stress onto the soil skeleton and resulting in long-term structural settlement.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['civil', 'geotechnical', 'soil mechanics', 'consolidation', 'compaction'],
    keywords: ['consolidation', 'compaction', 'pore water pressure', 'settlement', 'saturated clay', 'effective stress', 'terzaghi', 'soil density'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Soil Consolidation Dynamics', 'Effective Stress Principle', 'Foundation Engineering'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // ELECTRONICS & EMBEDDED SYSTEMS
  // ==========================================
  {
    field: 'Electronics',
    topic: 'Embedded Systems',
    subtopic: 'Protocols',
    question: 'Compare I2C, SPI, and UART communication protocols in embedded systems in terms of wire count, speed, and master-slave architecture.',
    answer: 'UART is an asynchronous, point-to-point full-duplex protocol requiring 2 data wires (TX, RX) plus ground, with no clock line and typical speeds up to 1-2 Mbps. I2C is a synchronous, half-duplex multi-master bus using 2 lines (SDA and SCL) with open-drain pull-up resistors and addressing capabilities supporting up to 127 devices at standard speeds (100kHz-3.4MHz). SPI is a synchronous, full-duplex protocol requiring 4 wires (MOSI, MISO, SCK, CS/SS); it lacks device addressing but reaches much higher data throughput (10-50MHz+) with lower software overhead.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['electronics', 'embedded', 'i2c', 'spi', 'uart', 'protocols'],
    keywords: ['i2c', 'spi', 'uart', 'sda', 'scl', 'mosi', 'miso', 'clock', 'full-duplex', 'asynchronous', 'bus architecture'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Serial Bus Protocols', 'Hardware Timing', 'Peripheral Interfacing'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Electronics',
    topic: 'Microcontrollers',
    subtopic: 'Interrupts & Timers',
    question: 'What is an Interrupt Service Routine (ISR)? Why should you avoid using delays, dynamic allocations, or blocking operations inside an ISR?',
    answer: 'An ISR is a specialized function automatically executed by the microcontroller hardware when an internal or external interrupt event triggers. ISRs must execute with utmost speed and return immediately because while an ISR is running, lower or equal-priority interrupts may be masked or delayed, causing system latency, missed pulses, or watchdog timer timeouts. Calling delays, blocking loops, or heap allocations inside an ISR can cause deadlocks, stack overflows, and non-deterministic real-time behavior.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['electronics', 'microcontrollers', 'isr', 'interrupts', 'rtos'],
    keywords: ['interrupt service routine', 'isr', 'latency', 'deadlock', 'volatile', 'non-blocking', 'watchdog', 'context switch'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Real-Time Systems', 'Interrupt Handling', 'Embedded Best Practices'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // COMMERCE & ACCOUNTING
  // ==========================================
  {
    field: 'Commerce',
    topic: 'Accounting Principles',
    subtopic: 'Financial Statements',
    question: 'Explain the fundamental accounting equation and demonstrate how buying inventory on credit affects the Balance Sheet and Cash Flow Statement.',
    answer: 'The fundamental accounting equation is Assets = Liabilities + Equity. When buying inventory on credit for $10,000, Current Assets (Inventory) increases by $10,000, and Current Liabilities (Accounts Payable) increases by $10,000, keeping the equation perfectly balanced. The Cash Flow Statement is unaffected at the time of purchase because no cash was disbursed; however, in indirect cash flow preparation, the increase in inventory is subtracted and the increase in accounts payable is added back, netting out to zero operational cash effect.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['commerce', 'accounting', 'balance sheet', 'cash flow', 'journal entries'],
    keywords: ['assets', 'liabilities', 'equity', 'balance sheet', 'accounts payable', 'inventory', 'cash flow statement', 'double-entry'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Double-Entry Bookkeeping', 'Working Capital Shifts', 'Financial Accounting'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Commerce',
    topic: 'Financial Analysis',
    subtopic: 'Depreciation & Cash',
    question: 'How does depreciation impact the Income Statement, Balance Sheet, and Cash Flow Statement of a corporation?',
    answer: 'On the Income Statement, depreciation is recorded as an operating expense, reducing EBIT and reducing taxable income (providing a tax shield). On the Balance Sheet, cumulative depreciation increases the contra-asset account Accumulated Depreciation, reducing the net book value of PP&E, while net income reduction flows into Retained Earnings. On the Cash Flow Statement under Operating Activities, depreciation is a non-cash expense and is added back to Net Income, increasing net operational cash by the tax shield savings.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['commerce', 'finance', 'depreciation', 'income statement', 'cash flow'],
    keywords: ['depreciation', 'non-cash expense', 'tax shield', 'accumulated depreciation', 'pp&e', 'retained earnings', 'ebit'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Three-Statement Modeling', 'Non-Cash Adjustments', 'Tax Shields'],
      scoreWeight: 9,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // FINANCE
  // ==========================================
  {
    field: 'Finance',
    topic: 'Corporate Valuation',
    subtopic: 'DCF & WACC',
    question: 'Walk me through a Discounted Cash Flow (DCF) model. How do you calculate Free Cash Flow to Firm (FCFF) and determine the terminal value?',
    answer: 'A DCF values a firm based on the present value of its future cash flows. First, project Unlevered Free Cash Flow (FCFF = EBIT * (1 - Tax Rate) + D&A - CapEx - Change in Net Working Capital) for a discrete period (typically 5-10 years). Discount these cash flows using the Weighted Average Cost of Capital (WACC). For terminal value, use either the Gordon Growth Model (Terminal FCF * (1 + g) / (WACC - g)) or the Exit Multiple Method. Summing the present value of discrete cash flows and discounted terminal value yields Enterprise Value; subtract net debt to derive Equity Value.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['finance', 'valuation', 'dcf', 'wacc', 'fcff', 'terminal value'],
    keywords: ['discounted cash flow', 'dcf', 'wacc', 'fcff', 'terminal value', 'gordon growth', 'ebit', 'capex', 'working capital', 'enterprise value'],
    expectedDuration: 150,
    metadata: {
      concepts: ['DCF Valuation', 'Capital Costing', 'Enterprise vs Equity Value'],
      scoreWeight: 9,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // MANAGEMENT & BUSINESS ANALYSIS
  // ==========================================
  {
    field: 'Management',
    topic: 'Business Analysis',
    subtopic: 'Requirements & Agile',
    question: 'How do you differentiate between Functional and Non-Functional Requirements? Provide an example of how you handle conflicting stakeholder requirements.',
    answer: 'Functional Requirements describe what the system must specifically do—its features, workflows, and calculations (e.g., "The system must generate an invoice PDF within 3 clicks"). Non-Functional Requirements define how the system operates—its quality attributes like performance, scalability, security, and availability (e.g., "The checkout page must load in under 500ms under 10,000 concurrent users"). To resolve conflicts, I facilitate a structured MoSCoW prioritization workshop, align requirements directly with measurable business KPIs and ROI, and document compromise trade-offs transparently.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['management', 'business analyst', 'requirements', 'functional', 'non-functional', 'agile'],
    keywords: ['functional requirements', 'non-functional requirements', 'stakeholder management', 'moscow prioritization', 'kpi alignment', 'trade-offs'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Requirements Engineering', 'Stakeholder Facilitation', 'Scope Management'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // MARKETING & DIGITAL STRATEGY
  // ==========================================
  {
    field: 'Marketing',
    topic: 'Digital Marketing',
    subtopic: 'Performance & CAC/LTV',
    question: 'What is the relationship between Customer Acquisition Cost (CAC) and Lifetime Value (LTV)? What metrics would you optimize if CAC is exceeding LTV?',
    answer: 'The LTV:CAC ratio measures business viability; a healthy sustainable ratio is typically 3:1 or higher. If CAC exceeds LTV, the business loses money on every acquired customer. To optimize CAC, I would audit targeting to eliminate low-converting ad cohorts, conduct A/B testing on landing page conversion rates (CRO), improve ad copy quality score, and invest in organic SEO and referral loops. To increase LTV, I would optimize onboarding to reduce early churn, implement email re-engagement flows, and develop cross-sell/upsell programs.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['marketing', 'digital marketing', 'cac', 'ltv', 'conversion rate', 'funnel'],
    keywords: ['customer acquisition cost', 'cac', 'lifetime value', 'ltv', 'churn rate', 'cro', 'retargeting', 'funnel optimization'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Growth Economics', 'Unit Economics', 'Performance Marketing'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // HUMAN RESOURCES
  // ==========================================
  {
    field: 'HR',
    topic: 'Talent Acquisition',
    subtopic: 'Structured Interviewing',
    question: 'Explain the STAR method for behavioral interviews. How do you mitigate unconscious bias during candidate evaluations?',
    answer: 'The STAR method structures behavioral responses into Situation (context), Task (goal/challenge), Action (specific initiatives the candidate took), and Result (quantifiable impact achieved). To eliminate unconscious bias, I implement structured competency-based rubrics with pre-defined scoring benchmarks, conduct blind resume reviews where candidate identifiers are redacted, assemble diverse interview panels, and require independent evaluations before panel calibration sessions.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['hr', 'recruitment', 'star method', 'unconscious bias', 'evaluation rubrics'],
    keywords: ['star method', 'behavioral interview', 'unconscious bias', 'structured interview', 'competency rubric', 'calibration'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Structured Hiring', 'DEI Best Practices', 'Talent Assessment'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // DESIGN / UI-UX
  // ==========================================
  {
    field: 'Design',
    topic: 'UI/UX Design',
    subtopic: 'Design Systems & Usability',
    question: 'What is Nielsen\'s Heuristic on "Visibility of System Status"? Provide a concrete UI example where violating this heuristic damages user trust.',
    answer: 'Nielsen\'s heuristic states that systems should always keep users informed about what is going on through appropriate, timely feedback within reasonable time. A classic violation occurs in financial checkout or file upload flows where clicking "Submit Payment" shows no loader, disabled button state, or progress indicator. Thinking the click failed, users repeatedly press the button, resulting in double-charges, error states, and severe loss of trust.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['design', 'ui/ux', 'heuristics', 'nielsen', 'design systems', 'usability'],
    keywords: ['heuristics', 'visibility of system status', 'feedback', 'user trust', 'loader', 'disabled state', 'usability testing'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Usability Heuristics', 'Interaction Feedback', 'Human-Computer Interaction'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // MECHANICAL ENGINEERING (EXTENDED)
  // ==========================================
  {
    field: 'Mechanical Engineering',
    topic: 'Heat Transfer',
    subtopic: 'Conduction & Convection',
    question: 'State Fourier’s Law of thermal conduction and explain how the overall heat transfer coefficient (U) accounts for both conduction and convection.',
    answer: 'Fourier’s Law states that heat conduction rate is proportional to the negative temperature gradient and perpendicular cross-sectional area (q = -k A dT/dx). When heat transfers through a composite wall surrounded by fluids, both convective boundary layers and conductive wall layers pose thermal resistance. The overall heat transfer coefficient U combines these resistances in series: 1/U = 1/h_inner + sum(L_i/k_i) + 1/h_outer, enabling simple heat flow rate calculations across complex heat exchanger geometries.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['mechanical', 'heat transfer', 'fouriers law', 'heat exchanger', 'thermal resistance'],
    keywords: ['fouriers law', 'conduction', 'convection', 'thermal conductivity', 'overall heat transfer coefficient', 'heat flux', 'thermal resistance'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Thermal Conduction', 'Convective Heat Transfer', 'Heat Exchanger Design'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Fluid Mechanics',
    subtopic: 'Bernoulli & Flow Regimes',
    question: 'State Bernoulli’s equation and list its key assumptions. How does the Reynolds number predict whether flow in a pipe is laminar or turbulent?',
    answer: 'Bernoulli’s equation states that total mechanical energy along a streamline remains constant: P/rho + v^2/2 + gz = constant. Assumptions include: steady flow, incompressible fluid, inviscid (frictionless) flow, and flow along a streamline. The Reynolds number (Re = rho*v*D / mu) compares inertial forces to viscous forces. In pipe flow, Re < 2300 indicates laminar flow dominated by viscous damping, while Re > 4000 indicates chaotic turbulent flow with high mixing and wall friction.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['mechanical', 'fluid mechanics', 'bernoulli', 'reynolds number', 'laminar flow'],
    keywords: ['bernoulli', 'reynolds number', 'laminar', 'turbulent', 'incompressible', 'viscosity', 'streamline', 'friction'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Bernoulli Principle', 'Viscous Forces', 'Pipe Flow Dynamics'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Machine Design',
    subtopic: 'Fatigue & Failure Theories',
    question: 'What causes mechanical fatigue failure, and how do engineers use the S-N curve and Goodman diagram to design components against cyclical loading?',
    answer: 'Fatigue failure occurs when a component fractures under repetitive cyclical stresses well below its ultimate tensile strength, initiating from microscopic stress concentration points and propagating cracks. The S-N (Stress vs Number of cycles) curve illustrates fatigue life, showing the endurance limit below which ferrous metals can withstand infinite cycles. When cyclic loads have non-zero mean stress, engineers use the Goodman diagram (relating alternating stress to mean stress and endurance limit) to design safe operating boundaries with an appropriate safety factor.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['mechanical', 'machine design', 'fatigue', 's-n curve', 'goodman diagram'],
    keywords: ['fatigue failure', 'cyclical stress', 'endurance limit', 'sn curve', 'goodman relation', 'stress concentration', 'crack propagation'],
    expectedDuration: 140,
    metadata: {
      concepts: ['Cyclic Fatigue', 'Endurance Limit', 'Failure Prevention'],
      scoreWeight: 9,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Manufacturing & Materials',
    subtopic: 'Phase Diagrams & Heat Treatment',
    question: 'Explain the Iron-Carbon equilibrium phase diagram and how quenching followed by tempering alters the microstructure and mechanical properties of steel.',
    answer: 'The Iron-Carbon diagram plots phase transformations of steel as a function of temperature and carbon composition, featuring ferrite, austenite, cementite, and pearlite. Heating steel to the austenite region and rapidly quenching it in water or oil prevents carbon diffusion, transforming face-centered austenite into a supersaturated, highly strained body-centered tetragonal phase called martensite, which is extremely hard but brittle. Subsequent tempering reheats martensite below lower critical temperature, allowing controlled carbide precipitation that relieves internal stress and restores fracture toughness.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['mechanical', 'materials science', 'heat treatment', 'phase diagram', 'metallurgy'],
    keywords: ['iron carbon diagram', 'austenite', 'martensite', 'ferrite', 'quenching', 'tempering', 'hardness', 'toughness'],
    expectedDuration: 130,
    metadata: {
      concepts: ['Phase Transformations', 'Martensitic Quenching', 'Tempering Dynamics'],
      scoreWeight: 9,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'HVAC & Thermal Systems',
    subtopic: 'Vapor Compression Refrigeration',
    question: 'Describe the 4 stages of the Vapor Compression Refrigeration System (VCRS) and how the Coefficient of Performance (COP) is calculated.',
    answer: 'VCRS operates across 4 stages: 1) Isentropic compression where low-pressure vapor refrigerant is compressed to high pressure and temperature; 2) Isobaric heat rejection in the condenser, condensing refrigerant into liquid; 3) Isenthalpic expansion through an expansion valve causing pressure and temperature drop; 4) Isobaric heat absorption in the evaporator, cooling the conditioned space. The COP is calculated as Desired Cooling Effect (Q_evap) divided by Work Input (W_comp).',
    difficulty: 'Easy',
    interviewType: 'Technical',
    tags: ['mechanical', 'hvac', 'refrigeration', 'vcrs', 'cop', 'compressor'],
    keywords: ['vcrs', 'refrigeration', 'compressor', 'condenser', 'expansion valve', 'evaporator', 'cop', 'latent heat'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Vapor Compression Cycle', 'COP Calculation', 'HVAC Engineering'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'Mechanical Engineering',
    topic: 'Vibrations & Dynamics',
    subtopic: 'Resonance & Damping',
    question: 'What is mechanical resonance in a single-degree-of-freedom system, and what strategies mitigate resonant vibration in rotating machinery?',
    answer: 'Resonance occurs when the frequency of an external periodic excitation force matches the natural frequency of the mechanical system, resulting in drastically amplified vibration amplitudes that can cause catastrophic structural failure. Mitigation strategies include: shifting the natural frequency away from operating speed (by modifying mass or structural stiffness), adding mechanical dampers (viscous or tuned mass dampers) to dissipate energy, implementing vibration isolation mounts, and dynamic balancing of rotating shafts.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['mechanical', 'vibrations', 'resonance', 'damping', 'natural frequency'],
    keywords: ['resonance', 'natural frequency', 'damping', 'vibration isolation', 'tuned mass damper', 'amplitude'],
    expectedDuration: 130,
    metadata: {
      concepts: ['Mechanical Resonance', 'Vibration Mitigation', 'Dynamic Balancing'],
      scoreWeight: 8,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true,
    }
  },

  // ==========================================
  // HR & BEHAVIORAL INTERVIEW QUESTIONS
  // ==========================================
  {
    field: 'General',
    topic: 'Behavioral',
    subtopic: 'Conflict Resolution',
    question: 'Tell me about a challenging situation where you faced technical disagreement with a colleague or lead. How did you resolve it constructively?',
    answer: 'In engineering and business contexts, technical disagreements are best resolved through objective data, prototypes, and alignment on core constraints. A structured response highlights acknowledging the colleague’s perspective, defining evaluation criteria (cost, performance, maintainability), running empirical tests or simulations, and prioritizing project goals over personal ego.',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'behavioral', 'conflict resolution', 'teamwork', 'communication'],
    keywords: ['conflict resolution', 'collaboration', 'active listening', 'objective data', 'team goals', 'professionalism'],
    expectedDuration: 90,
    metadata: {
      concepts: ['Interpersonal Communication', 'Constructive Conflict', 'Professional Collaboration'],
      scoreWeight: 7,
      estimatedAnswerTime: '1.5 minutes',
      isOriginal: true,
    }
  },
  {
    field: 'General',
    topic: 'Behavioral',
    subtopic: 'Adaptability & Pressure',
    question: 'Describe a project where critical scope or deadlines shifted unexpectedly. How did you adjust priorities and communicate with stakeholders?',
    answer: 'Demonstrates resilience, stakeholder management, and structured prioritization. The candidate outlines triaging critical path deliverables vs nice-to-have features, transparently updating project managers on trade-offs, and reallocating resources calmly without compromising quality or safety.',
    difficulty: 'Medium',
    interviewType: 'HR',
    tags: ['hr', 'behavioral', 'adaptability', 'pressure management', 'stakeholder communication'],
    keywords: ['adaptability', 'prioritization', 'critical path', 'stakeholder management', 'resilience', 'delivery'],
    expectedDuration: 90,
    metadata: {
      concepts: ['Agile Adaptation', 'Prioritization Matrices', 'Stakeholder Transparency'],
      scoreWeight: 7,
      estimatedAnswerTime: '1.5 minutes',
      isOriginal: true,
    }
  }
];

