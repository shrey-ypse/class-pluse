import { supabase } from './supabaseClient';
import { Question, StudentResponse, Session } from './types';
export type { Question, StudentResponse, Session };

declare global {
  var globalSessionStore: { [code: string]: Session } | undefined;
}

if (!globalThis.globalSessionStore) {
  globalThis.globalSessionStore = {};
}

const sessions = globalThis.globalSessionStore;

// Helper to generate a clean, random 4-digit code
function generateCode(): string {
  let code = '';
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (sessions[code]);
  return code;
}

export const sessionStore = {
  async createSession(subject: string, unit: string, topic: string, questions: Question[]): Promise<Session> {
    const code = generateCode();
    const session: Session = {
      code,
      subject,
      unit,
      topic,
      questions,
      activeQuestionIndex: -1, // starts in lobby
      status: 'lobby',
      isLocked: false,
      students: {},
      pivotPrompts: {},
      createdAt: new Date().toISOString(),
    };

    // Always store in memory as backup/fallback cache
    sessions[code] = session;

    if (supabase) {
      const { error } = await supabase
        .from('sessions')
        .insert({
          code,
          subject,
          unit,
          topic,
          questions,
          active_question_index: -1,
          status: 'lobby',
          is_locked: false,
          pivot_prompts: {},
          created_at: session.createdAt,
        });
      if (error) {
        console.error('Error creating Supabase session:', error);
      }
    }
    return session;
  },

  async getSession(code: string): Promise<Session | null> {
    if (supabase) {
      const { data: sData, error: sError } = await supabase
        .from('sessions')
        .select('*')
        .eq('code', code)
        .single();
      
      if (sError || !sData) {
        // Fallback to memory if database query fails
        return sessions[code] || null;
      }

      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('session_code', code);

      const studentsMap: { [rollNumber: string]: StudentResponse } = {};
      if (studentsData) {
        studentsData.forEach((s: any) => {
          studentsMap[s.roll_number] = {
            rollNumber: s.roll_number,
            name: s.name,
            answers: s.answers || {},
            joinedAt: s.joined_at,
            exitTicket: s.exit_confidence ? {
              confidence: s.exit_confidence,
              confusion: s.exit_confusion || ''
            } : undefined
          };
        });
      }

      const sessionObj = {
        code: sData.code,
        subject: sData.subject,
        unit: sData.unit || '',
        topic: sData.topic,
        questions: sData.questions || [],
        activeQuestionIndex: sData.active_question_index,
        status: sData.status as any,
        isLocked: sData.is_locked || false,
        students: studentsMap,
        pivotPrompts: sData.pivot_prompts || {},
        createdAt: sData.created_at,
      };

      // Keep cache updated
      sessions[code] = sessionObj;
      return sessionObj;
    } else {
      return sessions[code] || null;
    }
  },

  async updateSession(code: string, updater: (session: Session) => void): Promise<Session | null> {
    // Read from cache if exists, otherwise load from DB/fallback
    const session = sessions[code] || await this.getSession(code);
    if (!session) return null;
    updater(session);
    
    // Always keep cache in sync
    sessions[code] = session;

    if (supabase) {
      const { error } = await supabase
        .from('sessions')
        .update({
          active_question_index: session.activeQuestionIndex,
          status: session.status,
          is_locked: session.isLocked,
          questions: session.questions,
          pivot_prompts: session.pivotPrompts,
        })
        .eq('code', code);

      if (error) {
        console.error('Error updating Supabase session:', error);
      }
      return session;
    } else {
      return session;
    }
  },

  async joinStudent(code: string, rollNumber: string, name: string): Promise<boolean> {
    const normalizedRoll = rollNumber.trim().toUpperCase();
    
    // Always update cache first
    const session = sessions[code];
    if (session) {
      if (!session.students[normalizedRoll]) {
        session.students[normalizedRoll] = {
          rollNumber: normalizedRoll,
          name: name.trim(),
          answers: {},
          joinedAt: new Date().toISOString(),
        };
      } else {
        session.students[normalizedRoll].name = name.trim();
      }
    }

    if (supabase) {
      const { error } = await supabase
        .from('students')
        .upsert({
          session_code: code,
          roll_number: normalizedRoll,
          name: name.trim(),
          joined_at: new Date().toISOString()
        }, {
          onConflict: 'session_code,roll_number'
        });
      
      if (error) {
        console.error('Error joining student in Supabase:', error);
        // Fallback to cache success
        return !!session;
      }
      return true;
    } else {
      return !!session;
    }
  },

  async submitAnswer(code: string, rollNumber: string, questionId: string, answerIndex: number): Promise<boolean> {
    const normalizedRoll = rollNumber.trim().toUpperCase();
    
    // Always update cache first if not locked
    const session = sessions[code];
    if (session && !session.isLocked) {
      const student = session.students[normalizedRoll];
      if (student) {
        student.answers[questionId] = answerIndex;
      }
    }

    if (supabase) {
      // Fetch session from DB or fall back to cache to check lock state
      const { data: sData } = await supabase
        .from('sessions')
        .select('is_locked')
        .eq('code', code)
        .single();
      
      const isLocked = sData ? sData.is_locked : session?.isLocked;
      if (isLocked) return false; // Locked!

      const { data, error: fetchError } = await supabase
        .from('students')
        .select('answers')
        .eq('session_code', code)
        .eq('roll_number', normalizedRoll)
        .single();
      
      if (fetchError || !data) {
        // Fallback: if student is in cache, return true
        return !!(session && session.students[normalizedRoll]);
      }

      const currentAnswers = data.answers || {};
      currentAnswers[questionId] = answerIndex;

      const { error: updateError } = await supabase
        .from('students')
        .update({ answers: currentAnswers })
        .eq('session_code', code)
        .eq('roll_number', normalizedRoll);

      if (updateError) {
        console.error('Error submitting student answer to Supabase:', updateError);
        // Fallback: if student is in cache, return true
        return !!(session && session.students[normalizedRoll]);
      }
      return true;
    } else {
      const student = session?.students[normalizedRoll];
      return !!(session && !session.isLocked && student);
    }
  },

  async submitExitTicket(code: string, rollNumber: string, confidence: 'very' | 'somewhat' | 'not', confusion: string): Promise<boolean> {
    const normalizedRoll = rollNumber.trim().toUpperCase();
    
    // Always update cache first
    const session = sessions[code];
    if (session) {
      const student = session.students[normalizedRoll];
      if (student) {
        student.exitTicket = {
          confidence,
          confusion: confusion.trim(),
        };
      }
    }

    if (supabase) {
      const { error } = await supabase
        .from('students')
        .update({
          exit_confidence: confidence,
          exit_confusion: confusion.trim()
        })
        .eq('session_code', code)
        .eq('roll_number', normalizedRoll);

      if (error) {
        console.error('Error submitting exit ticket to Supabase:', error);
        // Fallback: if student is in cache, return true
        return !!(session && session.students[normalizedRoll]);
      }
      return true;
    } else {
      const student = session?.students[normalizedRoll];
      return !!(session && student);
    }
  },

  // Mock preset generator if AI keys aren't provided
  getMockQuestions(topic: string, count: number): Question[] {
    const lowerTopic = topic.toLowerCase();
    let presets: Question[] = [];

    // Keyword extractor helper
    const extractKeywords = (str: string): string[] => {
      const clean = str.replace(/[^a-zA-Z0-9\s]/g, '');
      const words = clean.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2);
      const stopWords = new Set([
        'and', 'the', 'for', 'with', 'from', 'this', 'that', 'your', 'about', 
        'today', 'topic', 'lesson', 'lecture', 'class', 'rules', 'examples', 
        'methods', 'basics', 'intro', 'introduction', 'overview', 'concept', 
        'concepts', 'defined', 'definition', 'core', 'some', 'many', 'what', 'parsed', 'notes'
      ]);
      const filtered = words.filter(w => !stopWords.has(w.toLowerCase()));
      return filtered.length > 0 ? filtered : ['System Architecture'];
    };

    const kw = extractKeywords(topic);
    const primaryConcept = kw[0] || 'System Module';
    const secondaryConcept = kw[1] || 'State Control';

    // 1. DATABASE & DBMS DOMAIN
    if (
      lowerTopic.includes('norm') || 
      lowerTopic.includes('dbms') || 
      lowerTopic.includes('database') ||
      lowerTopic.includes('sql') ||
      lowerTopic.includes('acid') ||
      lowerTopic.includes('key')
    ) {
      presets = [
        {
          id: 'q-db-1',
          text: `In relational database design, which anomaly occurs when deleting a row inadvertently deletes unrelated information (for example, removing today's lesson details of "${topic}" because the last enrolled student left)?`,
          options: [
            'Insertion Anomaly',
            'Update Anomaly',
            'Deletion Anomaly',
            'Constraint Violation'
          ],
          correctAnswerIndex: 2,
          explanation: 'Deletion anomaly happens when deleting a record deletes additional details that we actually want to retain. For example, deleting a student record that also contains the only record of a course detail.'
        },
        {
          id: 'q-db-2',
          text: `A table is in Second Normal Form (2NF) if it is in 1NF and contains absolutely no partial dependencies. What is a partial dependency?`,
          options: [
            'A non-prime attribute depends on only part of a composite primary key.',
            'A primary key depends on a foreign key.',
            'A non-key attribute depends on another non-key attribute.',
            'A column holds multiple comma-separated values.'
          ],
          correctAnswerIndex: 0,
          explanation: '2NF requires that every non-prime attribute is fully functionally dependent on the entire primary key, eliminating partial dependency where an attribute relies on only a portion of a composite key.'
        },
        {
          id: 'q-db-3',
          text: `If a table violates Third Normal Form (3NF) because of a transitive dependency, which of the following best describes this issue?`,
          options: [
            'A primary key value is duplicated across multiple rows.',
            'A non-prime attribute depends on another non-prime attribute (X -> Y and Y -> Z).',
            'A column contains nested JSON structures.',
            'A composite key has overlapping field definitions.'
          ],
          correctAnswerIndex: 1,
          explanation: '3NF is violated when a non-key attribute depends on another non-key attribute (transitive dependency). For instance, StudentID -> Major, and Major -> MajorDeanOffice.'
        }
      ];
    }
    // 2. OPERATING SYSTEMS DOMAIN
    else if (
      lowerTopic.includes('os') || 
      lowerTopic.includes('cpu') || 
      lowerTopic.includes('schedul') || 
      lowerTopic.includes('process') || 
      lowerTopic.includes('thread') || 
      lowerTopic.includes('deadlock') || 
      lowerTopic.includes('page') || 
      lowerTopic.includes('memory')
    ) {
      presets = [
        {
          id: 'q-os-1',
          text: `Which CPU scheduling algorithm preempts the currently running process if a new process arrives with a shorter remaining burst time?`,
          options: [
            'First-Come First-Served (FCFS)',
            'Shortest Remaining Time First (SRTF)',
            'Round Robin (RR) with a large time quantum',
            'Non-preemptive Priority Scheduling'
          ],
          correctAnswerIndex: 1,
          explanation: 'SRTF is the preemptive version of Shortest Job First (SJF). It compares the remaining runtimes and context-switches immediately if a shorter task enters the ready queue.'
        },
        {
          id: 'q-os-2',
          text: `In operating systems, which of the following is NOT one of the Coffman conditions required for a deadlock to occur?`,
          options: [
            'Mutual Exclusion',
            'Hold and Wait',
            'Preemptive Resource Allocation',
            'Circular Wait'
          ],
          correctAnswerIndex: 2,
          explanation: 'The Coffman conditions require "No Preemption" (resources cannot be forcibly taken). Preemptive resource allocation actually prevents deadlocks.'
        },
        {
          id: 'q-os-3',
          text: `In virtual memory paging systems, what causes 'thrashing' to occur?`,
          options: [
            'When the CPU frequency exceeds the bus bandwidth.',
            'When the page replacement algorithm fails to locate any dirty pages.',
            'When a process spends more time swapping page frames in/out than executing instructions.',
            'When concurrent threads access shared registers without locks.'
          ],
          correctAnswerIndex: 2,
          explanation: 'Thrashing occurs when the system does not have enough physical page frames, causing pages to be repeatedly evicted and re-loaded, bottlenecking execution with constant disk I/O.'
        }
      ];
    }
    // 3. DATA STRUCTURES & ALGORITHMS (DSA)
    else if (
      lowerTopic.includes('tree') || 
      lowerTopic.includes('bst') || 
      lowerTopic.includes('avl') || 
      lowerTopic.includes('graph') || 
      lowerTopic.includes('sort') || 
      lowerTopic.includes('recursion') || 
      lowerTopic.includes('complexity') ||
      lowerTopic.includes('algorithm')
    ) {
      presets = [
        {
          id: 'q-dsa-1',
          text: `What are the average and worst-case time complexities for searching a value in a standard Binary Search Tree (BST)?`,
          options: [
            'Average: O(1), Worst: O(log n)',
            'Average: O(log n), Worst: O(log n)',
            'Average: O(log n), Worst: O(n)',
            'Average: O(n), Worst: O(n log n)'
          ],
          correctAnswerIndex: 2,
          explanation: 'On average, a BST search splits the search space in half (O(log n)). However, if the tree becomes skewed (like a linked list), the search time degrades to O(n).'
        },
        {
          id: 'q-dsa-2',
          text: `To maintain O(log n) worst-case performance, an AVL Tree enforces a balance factor for every node. What values are allowed for an AVL balance factor?`,
          options: [
            'Only 0',
            '-1, 0, or 1',
            'Between -2 and 2 inclusive',
            'Any value less than log(n)'
          ],
          correctAnswerIndex: 1,
          explanation: 'An AVL tree is a self-balancing binary search tree. The balance factor (Height of Left Subtree - Height of Right Subtree) must be -1, 0, or 1. Otherwise, rotations are triggered.'
        },
        {
          id: 'q-dsa-3',
          text: `Which sorting algorithm guarantees a worst-case time complexity of O(n log n) while maintaining a stable sorting behavior?`,
          options: [
            'QuickSort',
            'HeapSort',
            'MergeSort',
            'BubbleSort'
          ],
          correctAnswerIndex: 2,
          explanation: 'MergeSort divides the array, sorts recursively, and merges. It guarantees O(n log n) time and is stable. QuickSort is unstable and can degrade to O(n^2). HeapSort is O(n log n) but unstable.'
        }
      ];
    }
    // 4. NETWORKING
    else if (
      lowerTopic.includes('network') || 
      lowerTopic.includes('tcp') || 
      lowerTopic.includes('ip') || 
      lowerTopic.includes('http') || 
      lowerTopic.includes('dns') || 
      lowerTopic.includes('udp') || 
      lowerTopic.includes('handshake')
    ) {
      presets = [
        {
          id: 'q-net-1',
          text: `Which packet sequence correctly describes the TCP three-way handshake initiated by a client to establish a connection?`,
          options: [
            'SYN -> SYN-ACK -> ACK',
            'SYN -> ACK -> SYN-ACK',
            'ACK -> SYN-ACK -> SYN',
            'PING -> PONG -> ACK'
          ],
          correctAnswerIndex: 0,
          explanation: 'The client sends a SYN (Synchronize). The server responds with SYN-ACK. The client replies with ACK (Acknowledge) to establish the sockets.'
        },
        {
          id: 'q-net-2',
          text: `Which transport layer protocol should be chosen for real-time video streaming where speed is prioritized over guaranteed packet delivery?`,
          options: [
            'TCP (Transmission Control Protocol)',
            'UDP (User Datagram Protocol)',
            'HTTP (Hypertext Transfer Protocol)',
            'FTP (File Transfer Protocol)'
          ],
          correctAnswerIndex: 1,
          explanation: 'UDP is connectionless and does not perform retransmissions, timeouts, or flow control. This makes it ideal for real-time flows where dropping a frame is better than buffering.'
        },
        {
          id: 'q-net-3',
          text: `In web networks, what is the significance of the HTTP status code range 400 to 499?`,
          options: [
            'Informational responses',
            'Successful operations',
            'Redirection messages',
            'Client-side errors'
          ],
          correctAnswerIndex: 3,
          explanation: 'HTTP status codes in the 4xx range indicate client errors (e.g., 400 Bad Request, 401 Unauthorized, 404 Not Found).'
        }
      ];
    }
    // 5. WEB DEVELOPMENT / JS
    else if (
      lowerTopic.includes('javascript') || 
      lowerTopic.includes('js') || 
      lowerTopic.includes('react') || 
      lowerTopic.includes('html') || 
      lowerTopic.includes('css') || 
      lowerTopic.includes('dom')
    ) {
      presets = [
        {
          id: 'q-web-1',
          text: `How does React's Virtual DOM improve web application rendering performance?`,
          options: [
            'By bypassing the browser\'s rendering engine entirely.',
            'By computing diffs in an in-memory JS representation and batching updates to the real DOM.',
            'By compiling JSX directly into assembly instructions.',
            'By running UI updates in a separate thread via Web Workers.'
          ],
          correctAnswerIndex: 1,
          explanation: 'React compares the previous Virtual DOM tree with the new one. It identifies the exact changes (reconciliation) and batches updates to the real DOM, avoiding expensive layout repaints.'
        },
        {
          id: 'q-web-2',
          text: `Which of the following CSS selectors holds the highest specificity when determining stylesheet applications?`,
          options: [
            'An element type selector (e.g. div)',
            'A class selector (e.g. .primary-btn)',
            'An ID selector (e.g. #header-banner)',
            'A universal selector (e.g. *)'
          ],
          correctAnswerIndex: 2,
          explanation: 'In CSS specificity, ID selectors (#id) weigh 100 times more than class selectors (.class), which weigh 10 times more than element type selectors.'
        },
        {
          id: 'q-web-3',
          text: `In JavaScript, what is the role of the Event Loop?`,
          options: [
            'To run multiple synchronous tasks in parallel using CPU cores.',
            'To monitor the Call Stack and the Callback Queue, pushing deferred callbacks onto the stack when it is empty.',
            'To cycle variables in memory to prevent garbage collection leaks.',
            'To cycle variables in memory to prevent garbage collection leaks.'
          ],
          correctAnswerIndex: 1,
          explanation: 'JavaScript is single-threaded. The Event loop allows asynchronous execution by executing callbacks (from API requests, timers) only when the main call stack has finished running.'
        }
      ];
    }
    // 6. DYNAMIC CONCEPT INTERPOLATION (GENERAL FALLBACKS)
    else {
      presets = [
        {
          id: 'q-gen-1',
          text: `When designing a system centered around "${primaryConcept}", which of the following represents the core architectural goal?`,
          options: [
            `Increasing the network latency to buffer incoming data packets.`,
            `Decoupling responsibilities of "${primaryConcept}" to isolate states and ensure clean modular boundaries.`,
            `Using only global shared state variables to maximize memory access speeds.`,
            `Eliminating automated unit testing completely.`
          ],
          correctAnswerIndex: 1,
          explanation: `When implementing ${primaryConcept}, separating concerns helps keep the codebase modular, robust, and much easier to debug.`
        },
        {
          id: 'q-gen-2',
          text: `What is a common pitfall developers encounter when implementing "${primaryConcept}" alongside "${secondaryConcept}"?`,
          options: [
            `Tightly coupling components, leading to cascading failures and logical race conditions.`,
            `Enforcing data validation checks at every ingress point.`,
            `Adding documentation comments to files.`,
            `None of the above.`
          ],
          correctAnswerIndex: 0,
          explanation: `A tight coupling of ${primaryConcept} with ${secondaryConcept} results in spaghetti code where a bug in one component breaks unrelated logic.`
        },
        {
          id: 'q-gen-3',
          text: `How does incorporating "${primaryConcept}" directly improve the scalability of today's subject, "${topic}"?`,
          options: [
            `By forcing single-threaded execution environments.`,
            `By allowing concurrent processing and clear isolation of the "${primaryConcept}" execution pipeline.`,
            `By increasing compile times significantly.`,
            `By requiring a database migration on every client request.`
          ],
          correctAnswerIndex: 1,
          explanation: `Structuring ${primaryConcept} correctly isolates computations, enabling easier horizontal scale-out and parallel processing in ${topic}.`
        }
      ];
    }

    const questions = [...presets];
    while (questions.length < count) {
      const idx = questions.length + 1;
      questions.push({
        id: `q-mock-pad-${idx}-${Date.now()}`,
        text: `Concept Check ${idx} (${primaryConcept}): Which constraint is essential when applying these principles to today's topic, "${topic}"?`,
        options: [
          `Preventing logical race conditions, data leaks, or unhandled exceptions.`,
          `Increasing memory latency to force CPU down-clocking.`,
          `Using unencrypted communication channels for core API tokens.`,
          `Bypassing code linting and version control.`
        ],
        correctAnswerIndex: 0,
        explanation: `When scaling ${topic}, a primary constraint is preventing concurrency issues (race conditions) and securing boundary operations.`
      });
    }

    return questions.slice(0, count);
  }
};
