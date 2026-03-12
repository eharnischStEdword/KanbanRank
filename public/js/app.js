const app = {
  respondentId: null,
  items: [],
  answers: {},

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    window.scrollTo(0, 0);
    // Show save FAB on survey and review screens
    var fab = document.getElementById('save-later-fab');
    if (fab) fab.style.display = (id === 'survey' || id === 'review') ? 'block' : 'none';
  },

  showSaveConfirmation() {
    this.saveProgress();
    var toast = document.getElementById('save-later-toast');
    if (toast) toast.classList.add('show');
  },

  hideSaveConfirmation() {
    var toast = document.getElementById('save-later-toast');
    if (toast) toast.classList.remove('show');
  },

  async startSurvey() {
    try {
      const saved = this.loadProgress();
      if (saved && saved.respondentId && Object.keys(saved.answers).length > 0) {
        this.pendingSave = saved;
        document.getElementById('resume-banner').style.display = 'block';
        return;
      }
      await this.beginFreshSurvey();
    } catch (err) {
      alert('Failed to connect. Please try again.');
    }
  },

  async resumeSurvey() {
    document.getElementById('resume-banner').style.display = 'none';
    try {
      this.respondentId = this.pendingSave.respondentId;
      this.answers = this.pendingSave.answers;
      this.pendingSave = null;
      const itemsRes = await fetch('/api/items');
      this.items = await itemsRes.json();
      // Verify respondent still exists (may have been cleared by admin)
      const checkRes = await fetch('/api/respondents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: null })
      });
      if (!checkRes.ok) throw new Error('Failed to create respondent');
      const data = await checkRes.json();
      this.respondentId = data.id;
      this.saveProgress();
      this.renderSurvey();
      this.showScreen('survey');
    } catch (err) {
      this.clearProgress();
      alert('Your saved session expired. Starting fresh.');
      await this.beginFreshSurvey();
    }
  },

  async startFresh() {
    document.getElementById('resume-banner').style.display = 'none';
    this.clearProgress();
    this.pendingSave = null;
    try {
      await this.beginFreshSurvey();
    } catch (err) {
      alert('Failed to connect. Please try again.');
    }
  },

  async beginFreshSurvey() {
    const res = await fetch('/api/respondents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: null })
    });
    const data = await res.json();
    this.respondentId = data.id;
    const itemsRes = await fetch('/api/items');
    this.items = await itemsRes.json();
    this.renderSurvey();
    this.showScreen('survey');
  },

  saveProgress() {
    try {
      localStorage.setItem('kanbanrank-progress', JSON.stringify({
        respondentId: this.respondentId,
        answers: this.answers
      }));
    } catch (e) {}
  },

  loadProgress() {
    try {
      const data = localStorage.getItem('kanbanrank-progress');
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },

  clearProgress() {
    try { localStorage.removeItem('kanbanrank-progress'); } catch (e) {}
  },

  renderSurvey() {
    const container = document.getElementById('items-container');
    container.innerHTML = '';

    const categories = {};
    this.items.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });

    let itemIndex = 0;

    for (const [category, items] of Object.entries(categories)) {
      const catHeader = document.createElement('div');
      catHeader.className = 'category-header';
      const catBadgeClass = this.categoryClass(category);
      catHeader.innerHTML = '<h2><span class="category-badge ' + catBadgeClass + '">' + this.esc(category) + '</span></h2>';
      container.appendChild(catHeader);

      items.forEach(item => {
        itemIndex++;
        const card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-item-id', item.id);

        const saved = this.answers[item.id] || {};

        const titleRow = document.createElement('div');
        titleRow.className = 'item-title-row';
        titleRow.innerHTML = '<span class="item-title">' + this.esc(item.title) + '</span>';
        card.appendChild(titleRow);

        const impWrap = document.createElement('div');
        impWrap.className = 'importance-wrap';
        const impLabel = document.createElement('div');
        impLabel.className = 'importance-label';
        impLabel.innerHTML = '<span>Not Important</span><span>Very Important</span>';
        impWrap.appendChild(impLabel);

        const dots = document.createElement('div');
        dots.className = 'importance-dots';
        for (let i = 1; i <= 5; i++) {
          const dot = document.createElement('button');
          dot.className = 'scale-dot';
          dot.textContent = i;
          if (saved.importance === i) dot.classList.add('selected');
          dot.onclick = () => {
            dots.querySelectorAll('.scale-dot').forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            if (!this.answers[item.id]) this.answers[item.id] = {};
            this.answers[item.id].importance = i;
            this.updateProgress();
            this.saveProgress();
          };
          dots.appendChild(dot);
        }
        impWrap.appendChild(dots);
        card.appendChild(impWrap);

        const dodLabel = document.createElement('label');
        dodLabel.className = 'dod-label';
        dodLabel.textContent = 'Definition of Done';
        card.appendChild(dodLabel);

        const textarea = document.createElement('textarea');
        textarea.className = 'open-text';
        textarea.placeholder = 'What does "done" look like for this item?';
        if (saved.definitionOfDone) textarea.value = saved.definitionOfDone;
        textarea.oninput = () => {
          if (!this.answers[item.id]) this.answers[item.id] = {};
          this.answers[item.id].definitionOfDone = textarea.value;
          this.saveProgress();
        };
        card.appendChild(textarea);

        const idk = document.createElement('label');
        idk.className = 'idk-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'idk-checkbox';
        if (saved.idk) {
          cb.checked = true;
          textarea.disabled = true;
          textarea.classList.add('disabled');
        }
        cb.onchange = () => {
          if (!this.answers[item.id]) this.answers[item.id] = {};
          this.answers[item.id].idk = cb.checked;
          this.saveProgress();
          textarea.disabled = cb.checked;
          textarea.classList.toggle('disabled', cb.checked);
        };
        idk.appendChild(cb);
        const idkText = document.createElement('span');
        idkText.className = 'idk-text';
        idkText.textContent = "I don\u2019t know, or I don\u2019t know enough about this to give a response";
        idk.appendChild(idkText);
        card.appendChild(idk);

        container.appendChild(card);
      });
    }

    this.updateProgress();
  },

  categoryClass(cat) {
    if (cat.includes('Facilities')) return 'cat-facilities';
    if (cat.includes('Faith')) return 'cat-faith';
    if (cat.includes('User')) return 'cat-ux';
    if (cat.includes('Culture')) return 'cat-culture';
    return '';
  },

  updateProgress() {
    const rated = Object.values(this.answers).filter(a => a.importance).length;
    const total = this.items.length;
    const pct = total > 0 ? (rated / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent = rated + ' of ' + total + ' items rated';
  },

  async submitSurvey() {
    const missing = this.items.filter(item => !this.answers[item.id] || !this.answers[item.id].importance);
    if (missing.length > 0) {
      alert('Please rate the importance of all ' + missing.length + ' remaining items before submitting.');
      const firstMissing = document.querySelector('[data-item-id="' + missing[0].id + '"]');
      if (firstMissing) firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.showScreen('submitting');

    const responses = this.items.map(item => {
      const answer = this.answers[item.id];
      return {
        itemId: item.id,
        importance: answer.importance,
        definitionOfDone: answer.idk ? null : (answer.definitionOfDone || '').trim(),
        idk: answer.idk || false
      };
    });

    const name = document.getElementById('respondent-name').value.trim();

    try {
      await fetch('/api/responses/' + this.respondentId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, name: name || null })
      });
      this.clearProgress();
      this.showScreen('done');
      this.launchConfetti();
    } catch (err) {
      alert('Failed to save. Please try again.');
      this.showScreen('survey');
    }
  },

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#1E40AF', '#F59E0B', '#DC2626', '#059669', '#7C3AED', '#EC4899', '#2563EB', '#FCD34D'];
    const pieces = [];
    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        rv: (Math.random() - 0.5) * 8
      });
    }

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        if (p.y > canvas.height + 20) return;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (alive && frame < 300) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(draw);
  },

  showReview() {
    const missing = this.items.filter(item => !this.answers[item.id] || !this.answers[item.id].importance);
    if (missing.length > 0) {
      alert('Please rate the importance of all ' + missing.length + ' remaining items before reviewing.');
      const firstMissing = document.querySelector('[data-item-id="' + missing[0].id + '"]');
      if (firstMissing) firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.renderReview();
    this.showScreen('review');
  },

  renderReview() {
    const container = document.getElementById('review-container');
    const sorted = this.items.slice().sort((a, b) => {
      return (this.answers[b.id].importance || 0) - (this.answers[a.id].importance || 0);
    });

    container.innerHTML = sorted.map(item => {
      const answer = this.answers[item.id];
      const imp = answer.importance;
      const catClass = this.categoryClass(item.category);
      const dod = answer.idk ? '' : (answer.definitionOfDone || '');
      const dodDisplay = answer.idk ? '<em style="color:var(--text-light)">Marked as "I don\'t know"</em>' : (dod ? this.esc(dod) : '<em style="color:var(--text-light)">No definition provided</em>');

      return '<div class="review-row" data-review-id="' + item.id + '">' +
        '<div class="review-row-main" onclick="app.toggleReviewDod(' + item.id + ')">' +
          '<div class="review-info">' +
            '<span class="review-title">' + this.esc(item.title) + '</span>' +
            '<span class="category-badge ' + catClass + '" style="font-size:0.7rem">' + this.esc(item.category) + '</span>' +
          '</div>' +
          '<div class="review-controls">' +
            '<button class="adj-btn" onclick="event.stopPropagation(); app.adjustImportance(' + item.id + ', -1)">−</button>' +
            '<span class="review-score" id="review-score-' + item.id + '" style="background:' + this.importanceColor(imp) + '">' + imp + '</span>' +
            '<button class="adj-btn" onclick="event.stopPropagation(); app.adjustImportance(' + item.id + ', 1)">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="review-dod" id="review-dod-' + item.id + '" style="display:none;">' +
          '<div class="review-dod-content" id="review-dod-display-' + item.id + '">' + dodDisplay + '</div>' +
          (answer.idk ? '' : '<textarea class="open-text review-dod-edit" id="review-dod-edit-' + item.id + '" oninput="app.updateReviewDod(' + item.id + ', this.value)">' + this.esc(dod) + '</textarea>') +
        '</div>' +
      '</div>';
    }).join('');
  },

  toggleReviewDod(itemId) {
    const dod = document.getElementById('review-dod-' + itemId);
    dod.style.display = dod.style.display === 'none' ? 'block' : 'none';
  },

  adjustImportance(itemId, delta) {
    const current = this.answers[itemId].importance;
    const next = Math.max(1, Math.min(5, current + delta));
    if (next === current) return;
    this.answers[itemId].importance = next;
    document.getElementById('review-score-' + itemId).textContent = next;
    this.renderReview();
  },

  updateReviewDod(itemId, value) {
    this.answers[itemId].definitionOfDone = value;
  },

  importanceColor(val) {
    var colors = { 1: '#DC2626', 2: '#F97316', 3: '#EAB308', 4: '#22C55E', 5: '#16A34A' };
    return colors[val] || '#94A3B8';
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
