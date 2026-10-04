const fs = require('fs');
const base = 'web/student-portal/student-portal/src/app/';
const path = base + 'modules/tests/take-test/take-test.component.html';
let source = fs.readFileSync(path, 'utf8');
const entries = {
  'Exam monitoring': 'परीक्षा निगरानी', 'Enable camera': 'कैमरा चालू करें',
  'By enabling, you consent to camera/audio recording and periodic snapshots for exam integrity.': 'चालू करने पर आप परीक्षा की निगरानी के लिए कैमरा, ऑडियो रिकॉर्डिंग और समय-समय पर तस्वीरें लेने की सहमति देते हैं।',
  'Time Left:': 'शेष समय:', 'Fullscreen': 'पूर्ण स्क्रीन', 'Question': 'प्रश्न', 'of': 'में से',
  'Marks:': 'अंक:', 'Negative:': 'ऋणात्मक अंक:', 'Marked for Review': 'पुनः जाँच के लिए चिह्नित',
  'Use ← → arrow keys to navigate, Space to mark review': 'प्रश्न बदलने के लिए ← → और पुनः जाँच हेतु Space दबाएँ',
  'Previous': 'पिछला', 'Clear': 'उत्तर हटाएँ', 'Save & Next': 'सहेजें और आगे बढ़ें',
  'Question Palette': 'प्रश्न सूची', 'Answered:': 'उत्तर दिए:', 'Not Answered:': 'उत्तर नहीं दिए:',
  'Marked for Review:': 'पुनः जाँच के लिए चिह्नित:', 'Time Spent:': 'लगा समय:',
  'Legend': 'संकेत', 'Answered': 'उत्तर दिया', 'Not Answered': 'उत्तर नहीं दिया', 'Current': 'वर्तमान',
  'Submit Test': 'टेस्ट जमा करें', 'Submitting...': 'जमा हो रहा है...', 'Fullscreen Required!': 'पूर्ण स्क्रीन आवश्यक है!',
  'This test must be taken in fullscreen mode.': 'यह टेस्ट पूर्ण स्क्रीन में देना आवश्यक है।',
  'Please switch to fullscreen to continue.': 'जारी रखने के लिए पूर्ण स्क्रीन चालू करें।',
  'Switch to Fullscreen': 'पूर्ण स्क्रीन चालू करें', 'Loading test...': 'टेस्ट लोड हो रहा है...',
  'Test:': 'टेस्ट:', 'Cancel': 'रद्द करें', 'Confirm Submit': 'जमा करने की पुष्टि करें',
  'Test Results': 'टेस्ट परिणाम', 'Time spent:': 'लगा समय:', 'Questions answered:': 'उत्तर दिए गए प्रश्न:',
  'Go to Dashboard': 'डैशबोर्ड पर जाएँ'
};
source = source.replace(/>([^<>]*)</g, (all, value) => {
  if (!entries[value.trim()]) return all;
  return '>' + value.replace(value.trim(), `{{ '${value.trim()}' | t:'${entries[value.trim()]}' }}`) + '<';
});
for (const text of ['Time Left:', 'Question', 'of', 'Marks:', 'Negative:', 'Time spent:', 'Questions answered:']) {
  source = source.replace(new RegExp('(^|>)(\\s*)' + text + ' (?=\\{\\{)', 'gm'), (_, prefix, ws) => `${prefix}${ws}{{ '${text}' | t:'${entries[text]}' }} `);
}
source = source.replace('}} of {{', "}} {{ 'of' | t:'में से' }} {{");
source = source.replace("{{ isMarkedForReview(currentQuestionIndex()) ? 'Review Marked' : 'Mark for Review' }}", "{{ isMarkedForReview(currentQuestionIndex()) ? ('Review Marked' | t:'पुनः जाँच चिह्नित') : ('Mark for Review' | t:'पुनः जाँच के लिए चिह्नित करें') }}");
source = source.replace('You have {{ getNotAnsweredCount() }} unanswered questions!', "{{ getNotAnsweredCount() }} {{ 'unanswered questions' | t:'प्रश्नों के उत्तर बाकी हैं' }}");
source = source.replace('{{ proctorMessage() }}', '{{ proctorMessage() | t }}').replace('{{ resultsMessage }}', '{{ resultsMessage | t }}');
source = source.replace('*ngIf="!proctoring.active()" (click)', '*ngIf="!proctoring.active()" [disabled]="proctoring.starting() || proctoring.pendingRecording()" (click)');
fs.writeFileSync(path, source);
