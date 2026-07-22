require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY. Set it in backend/.env before starting the server.');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT = `You are an intelligent educational evaluator for a learning platform.

Your role is to evaluate the student's answer fairly. Before giving a score, analyze whether the answer is related to the question.

Critical rule — verify before scoring:
Before assigning any score, work out the correct answer to the question yourself, independently of what the student wrote. Then compare the student's answer to that correct answer precisely (exact value for math, exact fact for science, exact word/choice for grammar). Never assume the student is correct just because they answered confidently or used correct-sounding language. If your own computed/known correct answer does not match the student's answer, the answer is wrong and must not score above the "partially correct" range, even if the student's wording sounds plausible. Your feedback text and your score must always agree with each other — never say the answer is correct while scoring it as wrong, or vice versa.

Evaluation process:

1. Relevance analysis:
- First determine if the student's answer is related to the question.
- If the answer is random, meaningless, unrelated, or does not attempt to answer the question:
  - Set score to 0.
  - Explain clearly in Arabic that the answer does not address the question.
  - Give minimum XP.

2. Correctness evaluation:
- If the answer is related:
  - Check if the information or final answer is correct.
  - Give partial credit for partially correct answers.
  - Accept correct final answers even if steps are missing, unless the question explicitly requests explanation or steps.

3. Short answers:
- Do not penalize students for short answers.
- A short answer is acceptable if it contains the correct idea or concept.

4. Subject-specific evaluation:
- Mathematics:
  - Check calculations, concepts, and final results.
  - Do not require solution steps unless requested.
- Science:
  - Check scientific accuracy.
  - Do not require detailed explanations unless the question asks for explanation.

5. Invalid answers:
Consider the answer invalid if it:
- Contains random unrelated words.
- Does not answer the question.
- Gives impossible or scientifically incorrect information.
- Only repeats the question without providing an answer.

6. Grammar / multiple-choice style questions (e.g. "choose the correct word/verb"):
- Accept the answer as correct if it contains the correct word or choice anywhere in it, even if the student adds extra explanation or filler text around it. Example: question "Choose the correct verb.", student answer "The correct answer is goes." — if "goes" is the correct choice, this must receive a high score, regardless of the extra wording.

Scoring guide:
- 90-100: Correct and complete answer.
- 70-89: Mostly correct with minor missing details.
- 40-69: Partially correct.
- 1-39: Related but mostly incorrect.
- 0: Unrelated, meaningless, or completely incorrect.

Give helpful, constructive feedback — do not just restate or give away the correct answer.

Return ONLY valid JSON without any extra text, in this exact key order (write "feedback" first so your reasoning about correctness is worked out before you commit to a "score" — the score must match the conclusion already stated in the feedback):
{"feedback": "Arabic feedback for the student, stating clearly whether the answer is correct, partially correct, or incorrect, and why", "score": number from 0 to 100, "strengths": ["short Arabic strength", "..."], "improvements": ["short Arabic improvement", "..."]}

Output rules:
- All Arabic text values must be written entirely in Modern Standard Arabic. Do not include any Chinese, English, or other non-Arabic script characters or words inside any text value.
- strengths and improvements must each be an array of 0 to 3 short Arabic sentences.
- If the score is 0 (unrelated/meaningless/invalid answer), strengths must be an empty array — do not invent positive points for an answer that does not address the question.
- If the score is greater than 0, strengths must contain at least one item.
- improvements must only contain constructive suggestions for how to improve, never just restated criticism.
- Do not include any text outside the JSON object.`;

// Groq/Llama models occasionally leak a stray CJK or Cyrillic token into
// otherwise-clean Arabic text. Strip those characters as a safety net since
// they should never legitimately appear in the output. Ranges cover CJK
// Unified Ideographs + Extension A, CJK Compatibility Ideographs, Hiragana,
// Katakana, Hangul Syllables, and Cyrillic.
const FOREIGN_SCRIPT_PATTERN = new RegExp(
  '[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF\\u3040-\\u30FF\\uAC00-\\uD7A3\\u0400-\\u04FF]',
  'g'
);

// Only these two subjects exist on the platform. Anything else gets
// rejected before it ever reaches the AI — this is the hard guardrail
// against off-topic challenges.
const ALLOWED_SUBJECTS = ['math', 'science'];

function stripStrayForeignScript(text) {
  return text
    .replace(FOREIGN_SCRIPT_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Deterministic XP rules based on the score band. The AI no longer
// invents this number — it is always computed here, so XP is
// predictable and consistent no matter what the model returns.
function computeXpFromScore(score) {
  if (score >= 90) return 100;
  if (score >= 70) return 70;
  if (score >= 40) return 40;
  if (score >= 1) return 15;
  return 10;
}

function sanitizeStringList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => stripStrayForeignScript(String(item || '')))
    .filter(Boolean)
    .slice(0, 3);
}

app.post('/api/evaluate', async (req, res) => {
  const { question, answer } = req.body || {};

  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Question: ${question}\n\nStudent Answer: ${answer}` }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);

    const score = clamp(Number(parsed.score), 0, 100);
    const feedback = stripStrayForeignScript(String(parsed.feedback || ''));
    const strengths = sanitizeStringList(parsed.strengths);
    const improvements = sanitizeStringList(parsed.improvements);
    const xp = computeXpFromScore(score);

    if (Number.isNaN(score) || !feedback) {
      throw new Error('Malformed AI response');
    }

    // Safety net: guarantee at least one strength whenever the answer scored
    // any credit, even if the model omitted it despite the prompt rule.
    if (score > 0 && strengths.length === 0) {
      strengths.push('الإجابة تحتوي على جزء صحيح.');
    }

    return res.json({ score, feedback, strengths, improvements, xp });
  } catch (error) {
    console.error('Groq evaluation failed:', error);
    return res.status(502).json({ error: 'AI evaluation failed' });
  }
});

const CHAT_BASE_PROMPT = `أنت "Delta AI"، مساعد تعليمي ذكي ضمن منصة تعليمية هدفها الأساسي مساعدة الطلاب على توظيف مفاهيم الرياضيات والعلوم في حياتهم اليومية، بدلاً من دراستها بشكل نظري بعيد عن الواقع.

قواعد أساسية:
- تحدث بالعربية الفصحى الواضحة والمبسطة فقط، ولا تستخدم أي كلمات أو حروف من لغات أخرى.
- تنسيق الإجابة إلزامي: لا تكتب أبداً فقرة نصية متصلة. قسّم أي إجابة فيها أكثر من فكرة واحدة إلى نقاط مرقّمة، كل نقطة بسطر منفصل يبدأ برقم متبوع بنقطة (مثال: "1. ..." ثم بسطر جديد "2. ...")، بحيث تكون كل نقطة جملة واحدة قصيرة ومباشرة. استخدم 2 إلى 5 نقاط عادة. إجابة من جملة واحدة بسيطة (مثل تحية أو تأكيد قصير) لا تحتاج ترقيماً.
- عندما يسأل الطالب عن مفهوم رياضي أو علمي، اربطه دائماً بمثال أو موقف من الحياة اليومية (تسوق، طبخ، رياضة، بناء، صحة، سفر...).
- إذا طلب الطالب حل مسألة أو تحدٍ مباشرة، لا تعطه الحل الجاهز فوراً. وجهه خطوة بخطوة (كنقاط مرقّمة) واطرح عليه أسئلة ترشده للتفكير بنفسه.
- إذا سألك عن نتيجة تحدٍ سابق قام به (سيتم تزويدك بمعلومات عنه إذا وجدت)، اشرح له بلطف نقاط القوة والضعف في إجابته كنقاط منفصلة، وساعده على الفهم دون تكرار الإجابة الصحيحة فقط.
- كن مشجعاً وودوداً، واجعل كل نقطة مختصرة ومركزة، ولا يتجاوز مجموع النقاط عادة 5 نقاط ما لم يطلب الطالب شرحاً مفصلاً.
- هذه المنصة تغطي فقط مادتي الرياضيات والعلوم. إذا سأل الطالب عن مادة أخرى تماماً (تاريخ، أدب، لغات...)، أخبره بلطف أن تخصصك محصور بالرياضيات والعلوم فقط، ووجّهه للسؤال ضمن هذا النطاق.`;

function buildChatSystemPrompt(context) {
  if (!context || !context.question) return CHAT_BASE_PROMPT;

  return `${CHAT_BASE_PROMPT}

سياق إضافي مهم: الطالب أنهى للتو تحدياً بعنوان "${context.title || 'غير معروف'}" في مادة "${context.subject || 'غير معروفة'}".
نص التحدي: "${context.question}"
إجابة الطالب: "${context.answer || 'غير متوفرة'}"
الدرجة التي حصل عليها: ${typeof context.score === 'number' ? context.score : 'غير متوفرة'}%
ملاحظات التقييم السابقة: "${context.feedback || 'لا توجد'}"

إذا سأل الطالب عن هذا التحدي، استخدم هذه المعلومات للإجابة بدقة ومساعدته على الفهم.`;
}

app.post('/api/chat', async (req, res) => {
  const { message, history, context } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const messages = [{ role: 'system', content: buildChatSystemPrompt(context) }];

    if (Array.isArray(history)) {
      history.slice(-10).forEach((entry) => {
        if (entry && (entry.role === 'user' || entry.role === 'assistant') && entry.content) {
          messages.push({ role: entry.role, content: String(entry.content) });
        }
      });
    }

    messages.push({ role: 'user', content: message });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7
    });

    const reply = completion.choices?.[0]?.message?.content || '';
    const cleanReply = stripStrayForeignScript(reply);

    if (!cleanReply) throw new Error('Empty AI reply');

    return res.json({ reply: cleanReply });
  } catch (error) {
    console.error('Groq chat failed:', error);
    return res.status(502).json({ error: 'AI chat failed' });
  }
});


const CHALLENGE_GENERATION_PROMPT = `أنت مولّد تحديات لمنصة تعليمية هدفها الأساسي مساعدة الطلاب على توظيف مفاهيم الرياضيات والعلوم في حياتهم اليومية.

قاعدة صارمة لا استثناء فيها:
هذه المنصة تغطي حصراً مادتي "الرياضيات" و"العلوم" ولا شيء غيرهما. أنت ممنوع منعاً باتاً من إنشاء تحدٍ يتعلق بأي مادة أخرى مهما كانت (تاريخ، جغرافيا، لغة عربية أو إنجليزية، أدب، دين، تربية وطنية، أو أي موضوع عام غير علمي). سيتم تزويدك دائماً بقيمة "المادة" وهي إما "math" أو "science" فقط — التزم بها حرفياً ولا تحد عنها مهما بدا عنوان الدرس أو ملخصه.

إذا كان عنوان الدرس أو ملخصه غامضاً أو غير مكتمل، لا تخترع موضوعاً من خارج الرياضيات أو العلوم لتعويض الغموض. بدلاً من ذلك، أعد صياغة أقرب مفهوم رياضي أو علمي عام يتناسب مع المادة المحددة (مثال: إذا كانت المادة "math" ولم يكن ملخص الدرس واضحاً، استخدم مفهوماً رياضياً عاماً مناسباً لمستوى الصف المحدد، كالنسب والتناسب أو الهندسة الأساسية).

مهمتك: بناءً على معلومات الدرس المعطاة، أنشئ تحديًا واقعيًا واحدًا يتطلب من الطالب استخدام مفهوم هذا الدرس لحل موقف من الحياة اليومية (تسوق، طبخ، رياضة، بناء، صحة، سفر، عمل...).

قواعد أساسية:
- لا تكتب سؤالاً أكاديميًا مباشرًا (مثل "احسب ناتج المعادلة..."). اكتب موقفاً واقعياً يحتاج هذا المفهوم لحله.
- اجعل السؤال واضحاً ومحدداً، بحيث يوجد له إجابة صحيحة يمكن التحقق منها.
- استخدم أرقاماً منطقية وواقعية في السؤال (لا أرقام عشوائية غير منطقية).
- اكتب باللغة العربية الفصحى فقط، بدون أي كلمات أو حروف من لغات أخرى.
- التحدي يجب أن يتناسب مع مستوى الصعوبة المحدد ومستوى الصف الدراسي.

أرجع فقط JSON صحيح بدون أي نص إضافي، بهذا الشكل بالضبط:
{"title": "عنوان قصير وجذاب للتحدي بالعربية", "question": "نص التحدي الكامل بالعربية"}`;

app.post('/api/generate-challenge', async (req, res) => {
  const { subject, lessonTitle, lessonSummary, difficulty, grade } = req.body || {};

  if (!subject || !lessonTitle) {
    return res.status(400).json({ error: 'subject and lessonTitle are required' });
  }

  // Hard guardrail: reject anything that isn't exactly one of the two
  // supported subjects before it ever reaches the AI. This is the primary
  // defense against off-topic challenges — the prompt below is the backup.
  if (!ALLOWED_SUBJECTS.includes(subject)) {
    return res.status(400).json({ error: 'subject must be "math" or "science"' });
  }

  try {
    const userPrompt = `المادة: ${subject}
عنوان الدرس: ${lessonTitle}
ملخص الدرس: ${lessonSummary || 'غير متوفر'}
مستوى الصعوبة: ${difficulty || 'متوسط'}
الصف الدراسي: ${grade || 'غير محدد'}

أنشئ تحديًا واحداً بناءً على هذه المعلومات، مع الالتزام الصارم بأن يكون التحدي في مادة "${subject}" فقط ولا شيء غيرها.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: CHALLENGE_GENERATION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);

    const title = stripStrayForeignScript(String(parsed.title || ''));
    const question = stripStrayForeignScript(String(parsed.question || ''));

    if (!title || !question) throw new Error('Malformed challenge generation response');

    return res.json({ title, question });
  } catch (error) {
    console.error('Challenge generation failed:', error);
    return res.status(502).json({ error: 'Challenge generation failed' });
  }
});

const HINT_PROMPT = `أنت مساعد تعليمي بمنصة Delta AI. مهمتك تقديم تلميح مفيد للطالب حول تحدٍ معين، دون إعطائه الحل النهائي أو الإجابة الصحيحة مباشرة.

قواعد أساسية:
- التلميح يوجّه الطالب للطريقة الصحيحة للتفكير، ولا يذكر الرقم أو الإجابة النهائية.
- اجعل التلميح قصيراً (جملة أو جملتين بحد أقصى).
- اكتب بالعربية الفصحى الواضحة فقط، بدون أي كلمات من لغات أخرى.
- إذا كان الطالب كتب محاولة إجابة، خذها بعين الاعتبار ووجّهه بناءً عليها إن كانت بداية جيدة أو تحتاج تصحيح.

أرجع فقط JSON بهذا الشكل بدون أي نص إضافي:
{"hint": "نص التلميح بالعربية"}`;

app.post('/api/hint', async (req, res) => {
  const { question, currentAnswer } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const userPrompt = `التحدي: ${question}\n\nمحاولة الطالب الحالية (قد تكون فارغة): ${currentAnswer || 'لم يكتب شيئًا بعد'}\n\nأعطني تلميحًا مناسبًا.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: HINT_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    const hint = stripStrayForeignScript(String(parsed.hint || ''));

    if (!hint) throw new Error('Empty hint response');

    return res.json({ hint });
  } catch (error) {
    console.error('Hint generation failed:', error);
    return res.status(502).json({ error: 'Hint generation failed' });
  }
});

const LESSON_GENERATION_PROMPT = `أنت خبير مناهج تعليمية لمنصة تعليمية هدفها تحويل مفاهيم الرياضيات والعلوم إلى تطبيقات حياتية.

مهمتك: بناءً على المادة والصف الدراسي المحددين، أنشئ قائمة دروس متسلسلة منطقيًا (من الأسهل للأصعب) تغطي مفاهيم أساسية بهذه المادة لهذا الصف.

قواعد أساسية:
- كل درس له عنوان قصير وملخص من جملة إلى جملتين يشرح المفهوم بوضوح ودقة (سيُستخدم هذا الملخص لاحقًا لتوليد تحديات واقعية بالذكاء الاصطناعي).
- اكتب بالعربية الفصحى فقط، بدون أي كلمات أو حروف من لغات أخرى.
- رتّب الدروس من الأسهل (سهل) إلى الأصعب (صعب) بتدرج منطقي مناسب للصف المحدد.
- لا تكرر نفس المفهوم بأكثر من درس.

أرجع فقط JSON بهذا الشكل بالضبط، بدون أي نص إضافي:
{"lessons": [{"title": "عنوان الدرس بالعربية", "summary": "ملخص الدرس بالعربية", "difficulty": "easy"}, {"title": "...", "summary": "...", "difficulty": "medium"}]}`;

app.post('/api/generate-lessons', async (req, res) => {
  const { subject, grade, count, topic } = req.body || {};

  if (!subject || !grade) {
    return res.status(400).json({ error: 'subject and grade are required' });
  }

  const lessonCount = Math.min(Math.max(Number(count) || 5, 1), 10);

  try {
    const userPrompt = `المادة: ${subject}
الصف الدراسي: ${grade}
عدد الدروس المطلوب: ${lessonCount}
${topic ? `تركيز خاص مطلوب (اختياري): ${topic}` : ''}

أنشئ قائمة الدروس المطلوبة بالعدد المحدد بالضبط.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: LESSON_GENERATION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);

    const lessons = Array.isArray(parsed.lessons)
      ? parsed.lessons
          .map((l) => ({
            title: stripStrayForeignScript(String(l.title || '')),
            summary: stripStrayForeignScript(String(l.summary || '')),
            difficulty: ['easy', 'medium', 'hard'].includes(l.difficulty) ? l.difficulty : 'medium'
          }))
          .filter((l) => l.title && l.summary)
      : [];

    if (!lessons.length) throw new Error('Empty lesson generation response');

    return res.json({ lessons });
  } catch (error) {
    console.error('Lesson generation failed:', error);
    return res.status(502).json({ error: 'Lesson generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Delta AI backend listening on port ${PORT}`);
});