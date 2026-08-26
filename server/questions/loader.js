const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const QUESTIONS_DIR = path.join(__dirname, '..', '..', 'questions');

class QuestionLoader {
  constructor() {
    this.cache = new Map();
  }

  // Parse a single MD file
  parseQuestionFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data: meta, content: body } = matter(content);

    const questions = [];
    const blocks = body.split('---').filter(b => b.trim());

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      let questionText = '';
      const options = [];
      let correctIndex = -1;
      let time = 15;
      let type = 'attack';

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Question line
        if (trimmed.startsWith('## ')) {
          questionText = trimmed.slice(3);
        }
        // Option line
        else if (trimmed.startsWith('- [x] ')) {
          options.push(trimmed.slice(6));
          correctIndex = options.length - 1;
        }
        else if (trimmed.startsWith('- [ ] ')) {
          options.push(trimmed.slice(6));
        }
        // Time
        else if (trimmed.startsWith('Time:')) {
          time = parseInt(trimmed.split(':')[1]) || 15;
        }
        // Type
        else if (trimmed.startsWith('Type:')) {
          type = trimmed.split(':')[1].trim() || 'attack';
        }
      }

      // Valid question must have text, 4 options, and 1 correct
      if (questionText && options.length === 4 && correctIndex >= 0) {
        questions.push({
          question: questionText,
          options,
          correctIndex,
          time,
          type
        });
      }
    }

    return {
      meta: {
        title: meta.title || path.basename(filePath, '.md'),
        difficulty: meta.difficulty || 'easy',
        category: meta.category || 'general',
        ...meta
      },
      questions
    };
  }

  // Load all questions from a directory
  loadFromDir(dirPath) {
    const questions = [];
    
    if (!fs.existsSync(dirPath)) {
      console.log(`[Questions] Directory not found: ${dirPath}`);
      return questions;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const data = this.parseQuestionFile(filePath);
      questions.push(data);
    }

    return questions;
  }

  // Load all questions
  loadAll() {
    const allQuestions = [];
    const categories = fs.readdirSync(QUESTIONS_DIR).filter(f => 
      fs.statSync(path.join(QUESTIONS_DIR, f)).isDirectory()
    );

    for (const category of categories) {
      const categoryPath = path.join(QUESTIONS_DIR, category);
      const questions = this.loadFromDir(categoryPath);
      allQuestions.push(...questions);
    }

    this.cache.set('all', allQuestions);
    return allQuestions;
  }

  // Get questions by category
  getByCategory(category) {
    const all = this.cache.get('all') || this.loadAll();
    return all.filter(q => q.meta.category === category);
  }

  // Get questions by difficulty
  getByDifficulty(difficulty) {
    const all = this.cache.get('all') || this.loadAll();
    return all.filter(q => q.meta.difficulty === difficulty);
  }

  // Get a random set of questions
  getRandomSet(count = 10, difficulty = null) {
    let all = this.cache.get('all') || this.loadAll();
    
    if (difficulty) {
      all = all.filter(q => q.meta.difficulty === difficulty);
    }

    // Flatten all questions
    const flatQuestions = all.flatMap(q => q.questions);
    
    // Shuffle
    for (let i = flatQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flatQuestions[i], flatQuestions[j]] = [flatQuestions[j], flatQuestions[i]];
    }

    return flatQuestions.slice(0, count);
  }

  // List all question sets
  listSets() {
    const all = this.cache.get('all') || this.loadAll();
    return all.map(q => ({
      title: q.meta.title,
      category: q.meta.category,
      difficulty: q.meta.difficulty,
      questionCount: q.questions.length
    }));
  }

  // Reload cache
  reload() {
    this.cache.clear();
    return this.loadAll();
  }
}

module.exports = new QuestionLoader();
