import { QuestionBank } from '../models/questionBank';
import PageSetting from '../models/pageSetting';

const defaultQuestions = [
  // ===== JAVASCRIPT QUESTIONS =====
  {
    field: 'Computer Science',
    topic: 'JavaScript',
    subtopic: 'Closures',
    question: 'What is a closure in JavaScript, and how does it work? Provide a real-world use case.',
    answer: 'A closure is the combination of a function bundled together with references to its surrounding state (the lexical environment). In other words, a closure gives an inner function access to the outer function scope even after the outer function has returned. A common real-world usecase is data encapsulation/privacy, such as creating a counter function where the private count variable cannot be accessed or modified from the outside except through defined methods.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['javascript', 'closures', 'scope', 'encapsulation'],
    keywords: ['lexical environment', 'lexical scope', 'inner function', 'outer function', 'encapsulation', 'closure'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Lexical Scope', 'Closures', 'Data Privacy'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      answerQuality: 85,
      technicalDepth: 80,
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'JavaScript',
    subtopic: 'Event Loop',
    question: 'Explain the JavaScript Event Loop, task queue, and microtask queue. What is the execution order of promises and timeouts?',
    answer: 'JavaScript is single-threaded and non-blocking, enabled by the Event Loop. When synchronous code finishes executing in the Call Stack, the Event Loop checks the Microtask Queue first (which holds Promise resolutions, process.nextTick, queueMicrotask) and executes all microtasks. Only when the Microtask Queue is completely empty does it check the Task/Callback Queue (which holds setTimeout, setInterval, UI events) to execute the next callback. Therefore, promise resolutions always run before timeout callbacks.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['javascript', 'event loop', 'asynchronous', 'promises'],
    keywords: ['event loop', 'call stack', 'microtask queue', 'task queue', 'callback queue', 'single threaded', 'non-blocking', 'promises', 'settimeout'],
    expectedDuration: 180,
    metadata: {
      concepts: ['Asynchronous Execution', 'Event Loop', 'Execution Context'],
      scoreWeight: 8,
      estimatedAnswerTime: '3 minutes',
      answerQuality: 90,
      technicalDepth: 85,
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'JavaScript',
    subtopic: 'Promises',
    question: 'What is the difference between Promise.all, Promise.allSettled, and Promise.race in JavaScript?',
    answer: 'Promise.all resolves when all promises in the iterable resolve, but immediately rejects if any promise rejects. Promise.allSettled waits for all input promises to settle (either resolve or reject) and returns an array of objects describing each outcome. Promise.race resolves or rejects as soon as the first promise in the iterable settles (either resolves or rejects).',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['javascript', 'promises', 'async'],
    keywords: ['promise.all', 'promise.allsettled', 'promise.race', 'resolves', 'rejects', 'settled', 'concurrency'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Promise Concurrency', 'Asynchronous Control Flow'],
      scoreWeight: 6,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'JavaScript',
    subtopic: 'Hoisting',
    question: 'Explain hoisting in JavaScript. How do var, let, and const differ in terms of hoisting and scoping?',
    answer: 'Hoisting is JavaScript\'s default behavior of moving declarations to the top of the current scope before execution. "var" is hoisted and initialized with "undefined", making it accessible before declaration (though its value is undefined). "let" and "const" are also hoisted but not initialized, placing them in a "Temporal Dead Zone" (TDZ) from the start of the block until the declaration is evaluated; accessing them before declaration throws a ReferenceError. Var is function-scoped, whereas let and const are block-scoped.',
    difficulty: 'Easy',
    interviewType: 'Technical',
    tags: ['javascript', 'hoisting', 'variables', 'scope'],
    keywords: ['hoisting', 'temporal dead zone', 'tdz', 'block scope', 'function scope', 'var', 'let', 'const', 'undefined', 'declaration'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Hoisting', 'Temporal Dead Zone', 'Variable Scope'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'JavaScript',
    subtopic: 'Prototypes',
    question: 'What is prototypal inheritance in JavaScript? How does the prototype chain work?',
    answer: 'In JavaScript, objects have an internal link to another object called their prototype. Prototypal inheritance means that an object can inherit properties and methods from its prototype. When we try to access a property on an object, JavaScript first looks at the object itself. If it is not found, it travels up the link to the object\'s prototype, continuing up the prototype chain until it either finds the property or reaches null (the end of the chain at Object.prototype.__proto__).',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['javascript', 'prototypes', 'oop', 'inheritance'],
    keywords: ['prototypal inheritance', 'prototype chain', 'prototype', '__proto__', 'object.prototype', 'constructor function', 'class'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Prototypal Inheritance', 'Object-Oriented Programming'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },

  // ===== PYTHON QUESTIONS =====
  {
    field: 'Computer Science',
    topic: 'Python',
    subtopic: 'Decorators',
    question: 'What are decorators in Python, and how do they work? Write a simple example of a logging decorator.',
    answer: 'A decorator in Python is a design pattern that allows a programmer to modify or extend the behavior of a function or class without permanently modifying its source code. Under the hood, decorators are wrapper functions that take a function as an argument, perform some actions before and/or after calling the target function, and return the wrapper. For example, a logging decorator prints the function name and arguments before executing and logging its completion.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['python', 'decorators', 'functions', 'wrapper'],
    keywords: ['decorator', 'wrapper', 'first-class functions', 'nested functions', 'syntactic sugar', '@ symbol'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Decorators', 'Higher-Order Functions'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Python',
    subtopic: 'GIL',
    question: 'What is the Global Interpreter Lock (GIL) in CPython, and how does it affect CPU-bound and I/O-bound multi-threaded applications?',
    answer: 'The Global Interpreter Lock (GIL) is a mutex in CPython that protects access to Python objects, preventing multiple native threads from executing Python bytecodes at once. For CPU-bound applications, the GIL prevents true parallelism even on multi-core systems, making multi-threading ineffective; instead, developers should use the multiprocessing module or alternative interpreters like PyPy. For I/O-bound applications, the GIL is released during system/network calls, so multi-threading remains highly effective for overlapping wait times.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['python', 'gil', 'concurrency', 'multithreading', 'cpython'],
    keywords: ['global interpreter lock', 'gil', 'cpython', 'cpu-bound', 'i/o-bound', 'multithreading', 'multiprocessing', 'mutex', 'concurrency'],
    expectedDuration: 180,
    metadata: {
      concepts: ['CPython Execution Model', 'Global Interpreter Lock', 'Concurrency Patterns'],
      scoreWeight: 9,
      estimatedAnswerTime: '3 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Python',
    subtopic: 'Memory Management',
    question: 'Explain Python\'s memory management, garbage collection, and reference counting mechanisms.',
    answer: 'Python utilizes automatic memory management. The primary mechanism is reference counting: every object tracks how many references point to it, and when the count drops to zero, the memory is immediately deallocated. To solve the issue of reference cycles (where two or more objects reference each other, maintaining counts above zero), Python runs a cyclic garbage collector. This collector groups objects into three generations and periodically triggers traversal to identify and sweep unreachable reference loops.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['python', 'memory', 'garbage collection', 'reference counting'],
    keywords: ['garbage collection', 'reference counting', 'reference cycle', 'generations', 'memory deallocation', 'heap'],
    expectedDuration: 150,
    metadata: {
      concepts: ['Memory Management', 'Garbage Collection Algorithms'],
      scoreWeight: 8,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Python',
    subtopic: 'Generators',
    question: 'What are Python generators and the "yield" keyword? How do they differ from normal functions in terms of memory efficiency?',
    answer: 'Generators are special Python functions that return a lazy iterator using the "yield" keyword instead of "return". Unlike normal functions which run to completion and return a full list of results, a generator pauses execution and yields a single value to the caller, saving its current state for the next call. This provides extreme memory efficiency (O(1) memory complexity) because values are generated on-the-fly and not held in memory at once.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['python', 'generators', 'yield', 'memory', 'iterators'],
    keywords: ['generator', 'yield', 'iterator', 'lazy evaluation', 'memory efficiency', 'state retention'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Generators & Iterators', 'Lazy Evaluation', 'Memory Optimization'],
      scoreWeight: 6,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Python',
    subtopic: 'List Comprehensions',
    question: 'What are list comprehensions in Python, and how do they differ in performance and syntax from standard loops?',
    answer: 'List comprehensions provide a concise syntax for creating lists from existing iterables. Syntactically, they combine the loop and conditional filters into a single line. In terms of performance, list comprehensions are typically faster than standard for-loops with `.append()` because the loop is executed in optimized C code inside the CPython interpreter, avoiding the overhead of looking up and calling the append method repeatedly.',
    difficulty: 'Easy',
    interviewType: 'Technical',
    tags: ['python', 'list comprehension', 'performance', 'loops'],
    keywords: ['list comprehension', 'for loop', 'performance', 'append method', 'syntactic sugar'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Syntactic Curation', 'Optimized Loop Execution'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },

  // ===== JAVA QUESTIONS =====
  {
    field: 'Computer Science',
    topic: 'Java',
    subtopic: 'JVM Garbage Collection',
    question: 'How does Garbage Collection work in Java? Explain the difference between Minor GC, Major GC, and the concept of generations (Eden, Survivor, Tenured).',
    answer: 'Java Garbage Collection operates on the weak generational hypothesis, dividing heap memory into Young and Old generations. The Young generation contains Eden space (where new objects are allocated) and two Survivor spaces (S0 and S1). When Eden fills, a Minor GC triggers, sweeping dead objects and copying survivors to S1 (and incrementing their age). If an object survives enough generations, it is promoted to the Tenured/Old generation. Major/Full GC runs on the Old generation when it is full, sweeping long-lived objects. Major GCs are much slower and trigger Stop-The-World pauses.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['java', 'garbage collection', 'jvm', 'heap'],
    keywords: ['garbage collection', 'jvm heap', 'eden space', 'survivor space', 'minor gc', 'major gc', 'tenured generation', 'stop-the-world'],
    expectedDuration: 180,
    metadata: {
      concepts: ['Java Virtual Machine', 'Garbage Collection Generational Model'],
      scoreWeight: 8,
      estimatedAnswerTime: '3 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Java',
    subtopic: 'OOP Concepts',
    question: 'What is the difference between an abstract class and an interface in Java, especially after Java 8 and 9?',
    answer: 'An abstract class can declare instance fields, state, constructors, and define non-public/non-static methods, and a subclass can only extend one abstract class. An interface traditionally only had abstract public methods and constant fields, but Java 8 introduced "default" and "static" methods, and Java 9 added "private" methods for code reuse inside the interface. Classes can implement multiple interfaces. Abstract classes represent an "is-a" relationship, while interfaces represent a "can-do" capability.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['java', 'oop', 'interface', 'abstract class'],
    keywords: ['abstract class', 'interface', 'default methods', 'multiple inheritance', 'constructor', 'java 8', 'java 9'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Object-Oriented Design', 'Interfaces & Abstract Classes'],
      scoreWeight: 6,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Java',
    subtopic: 'Multithreading',
    question: 'What is the difference between "synchronized" blocks and Lock interfaces (like ReentrantLock) in Java concurrency?',
    answer: '"synchronized" is an implicit keyword built into the JVM that automatically handles acquiring and releasing a monitor lock on an object, releasing it even during exceptions. `ReentrantLock` from `java.util.concurrent.locks` is an explicit class-based mechanism that offers advanced features like lock polling (`tryLock`), lock interrupts, fairness queues, and multiple condition variables. However, ReentrantLock requires the programmer to explicitly call `lock()` and `unlock()` in a `try-finally` block to prevent deadlock.',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['java', 'multithreading', 'synchronized', 'reentrantlock', 'concurrency'],
    keywords: ['synchronized', 'reentrantlock', 'trylock', 'monitor lock', 'concurrency', 'deadlock', 'fairness'],
    expectedDuration: 150,
    metadata: {
      concepts: ['Concurreny Mutexes', 'Thread Synchronization'],
      scoreWeight: 8,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Java',
    subtopic: 'Java Memory Model',
    question: 'Explain the purpose of the "volatile" keyword in Java. How does it relate to the Java Memory Model and caching?',
    answer: 'In Java, threads can cache variables in CPU registers or local caches for performance. The "volatile" keyword guarantees visibility of changes to variables across threads. When a variable is declared volatile, the JVM is instructed to always read and write the variable directly to main memory, bypassing CPU caches. It also prevents the compiler and CPU from reordering instructions around the volatile read/write, ensuring correct memory ordering.',
    difficulty: 'Medium',
    interviewType: 'Technical',
    tags: ['java', 'volatile', 'memory model', 'concurrency', 'caching'],
    keywords: ['volatile', 'main memory', 'cpu cache', 'thread visibility', 'instruction reordering', 'caching', 'concurrency'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Java Memory Model', 'Thread Visibility & Memory Barriers'],
      scoreWeight: 7,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'Java',
    subtopic: 'Collections Framework',
    question: 'How does a HashMap work internally in Java? Explain hash collisions, bucket nodes, and treeification.',
    answer: 'HashMap in Java operates on hashing principles. It uses an internal array of nodes (buckets). When `put(key, value)` is called, the key\'s `hashCode()` is passed to a hashing function to compute the array index. If multiple keys hash to the same index (hash collision), they are stored as a singly linked list in that bucket node. In Java 8, if a bucket\'s list size exceeds 8 (threshold) and the total table capacity is at least 64, HashMap converts the linked list into a self-balancing Red-Black Tree (treeification) to improve search time from O(n) to O(log n).',
    difficulty: 'Hard',
    interviewType: 'Technical',
    tags: ['java', 'hashmap', 'collections', 'hashing'],
    keywords: ['hashmap', 'hashcode', 'hash collision', 'linked list', 'red-black tree', 'treeification', 'bucket', 'hashing', 'o(log n)'],
    expectedDuration: 180,
    metadata: {
      concepts: ['Data Structures', 'Hashing and Map Implementations'],
      scoreWeight: 8,
      estimatedAnswerTime: '3 minutes',
      isOriginal: true
    }
  },

  // ===== GENERAL HR QUESTIONS =====
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Tell me about yourself. Walk me through your professional background and career goals.',
    answer: 'A structured walk-through highlighting: 1. Present focus (current degree, studies, projects), 2. Past achievements (academic proof-of-work, internships, core skills acquired), and 3. Future path (why this specific career path aligns with professional ambitions). Keep it concise (under 2 minutes) and professional, highlighting soft skills and domain interest.',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'introduction', 'soft skills'],
    keywords: ['introduce yourself', 'career background', 'goals', 'education', 'passion', 'professional journey'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Professional Communication', 'Self Presentation'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'What are your greatest professional strengths and weaknesses? How do you work to improve your weaknesses?',
    answer: 'Strengths should be professional and relevant (e.g. rapid learning, strong analytical problem solving, self-discipline). Weaknesses should be genuine but constructive, not fatal flaws (e.g. taking on too many tasks, speaking up in large meetings initially), coupled with a concrete, ongoing plan of self-improvement showing active self-reflection.',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'strengths', 'weaknesses'],
    keywords: ['strengths', 'weaknesses', 'self-improvement', 'analytical skills', 'growth mindset'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Self Awareness', 'Professional Growth'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Why do you want to join our organization specifically? What makes you a great fit?',
    answer: 'A tailored response connecting the organization\'s core mission, values, and technological growth with the candidate\'s own career trajectory, showing that the candidate researched the organization and is excited about contributing to their specific challenges.',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'motivation', 'alignment'],
    keywords: ['company alignment', 'culture fit', 'motivation', 'mission', 'contribution', 'value add'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Corporate Alignment', 'Motivation Curation'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Describe a challenging technical project you worked on. What obstacles did you face, and how did you resolve them?',
    answer: 'Answers should follow the STAR structure: Situation, Task, Action, and Result. Detail the technical complexity, explain how you researched and isolated the bugs or design issues, outline your proactive technical actions, and summarize the positive measurable outcome (speed increase, accuracy, verified grade, etc.).',
    difficulty: 'Medium',
    interviewType: 'HR',
    tags: ['hr', 'behavioral', 'star method', 'project'],
    keywords: ['star method', 'project', 'challenging problem', 'technical resolution', 'problem solving', 'overcoming obstacles'],
    expectedDuration: 150,
    metadata: {
      concepts: ['Structured Problem Solving', 'Technical Storytelling (STAR)'],
      scoreWeight: 6,
      estimatedAnswerTime: '2.5 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'How do you prioritize your tasks when facing multiple tight deadlines? Provide an example.',
    answer: 'Describe a systematic approach (e.g. Eisenhower Matrix, daily checklists, direct communication with managers or teammates) to prioritize high-impact tasks, manage stress, block out distractions, and successfully coordinate team timelines to deliver results on time.',
    difficulty: 'Medium',
    interviewType: 'HR',
    tags: ['hr', 'time management', 'prioritization'],
    keywords: ['time management', 'prioritization', 'deadlines', 'stress handling', 'coordination', 'planning'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Time Management & Discipline', 'Priority Curation'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Describe a situation where you had a conflict with a teammate. How did you handle it and what was the outcome?',
    answer: 'Focus on constructive resolution: active listening, seeking common ground, having direct but professional, empathetic conversations, and aligning on project requirements or third-party guidelines to resolve disputes objectively, maintaining healthy collaborative relationships.',
    difficulty: 'Medium',
    interviewType: 'HR',
    tags: ['hr', 'conflict resolution', 'teamwork'],
    keywords: ['conflict resolution', 'collaboration', 'active listening', 'professional empathy', 'compromise', 'team dynamic'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Conflict Resolution & Collaboration', 'Emotional Intelligence'],
      scoreWeight: 6,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Where do you see yourself in 5 years? What is your roadmap for professional growth?',
    answer: 'Express a strong commitment to mastering technical domain expertise, transitioning into architecture or technical leadership roles, contributing to critical system designs, and continuing lifetime learning through certifications and impactful proof-of-work projects.',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'career goals', 'five years'],
    keywords: ['career projection', 'professional mastery', 'technical leadership', 'growth trajectory', 'lifetime learning'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Career Planning & Longevity', 'Professional Vision'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  },
  {
    field: 'Computer Science',
    topic: 'General',
    question: 'Do you have any questions for us regarding the role or the team dynamic?',
    answer: 'Prepare intelligent, proactive questions reflecting professional ambition (e.g. asking about technical stacks, team methodologies, onboarding metrics, and what success looks like in the first 90 days), rather than passive questions (salary, hours).',
    difficulty: 'Easy',
    interviewType: 'HR',
    tags: ['hr', 'closing', 'interest'],
    keywords: ['closing questions', 'onboarding success', 'team methodologies', 'technical challenges', 'proactivity'],
    expectedDuration: 120,
    metadata: {
      concepts: ['Engagement and Ambition', 'Interview Closing'],
      scoreWeight: 5,
      estimatedAnswerTime: '2 minutes',
      isOriginal: true
    }
  }
];

import { multiDomainQuestions } from './multiDomainQuestions';

export async function seedQuestions() {
  try {
    const allQuestions = [...defaultQuestions, ...multiDomainQuestions];
    let insertedCount = 0;

    for (const q of allQuestions) {
      const res = await QuestionBank.updateOne(
        { question: q.question },
        { 
          $setOnInsert: {
            ...q,
            status: 'Active',
            approved: true,
            source: 'Verified Seeder',
          }
        },
        { upsert: true }
      );
      if (res.upsertedCount > 0) {
        insertedCount += 1;
      }
    }

    const totalCount = await QuestionBank.countDocuments({});
    console.log(`[seeder] Multi-domain question bank synchronized. ${insertedCount} new questions added. Total active questions: ${totalCount}.`);
  } catch (error) {
    console.error('[seeder] Error seeding question bank:', error);
  }
}

export async function seedPageSettings() {
  try {
    const count = await PageSetting.countDocuments({});
    if (count > 0) {
      console.log(`[seeder] Page settings already populated. Skipping seed.`);
      return;
    }

    console.log('[seeder] Empty page_settings detected. Seeding defaults...');
    const defaultSettings = [
      { pageId: 'career-twin', label: 'Career Twin', isHidden: false },
      { pageId: 'learning', label: 'Learning Hub', isHidden: false },
      { pageId: 'interview', label: 'AI Interview Coach', isHidden: false },
      { pageId: 'jobs', label: 'Job Portal', isHidden: false },
      { pageId: 'community', label: 'Community Forum', isHidden: false }
    ];

    await PageSetting.insertMany(defaultSettings);
    console.log(`[seeder] Seeded default page visibility settings successfully!`);
  } catch (error) {
    console.error('[seeder] Error seeding page settings:', error);
  }
}
