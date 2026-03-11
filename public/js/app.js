const app = {
  respondentId: null,
  items: [],
  answers: {},

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
    window.scrollTo(0, 0);
  },

  async startSurvey() {
    try {
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
    } catch (err) {
      alert('Failed to connect. Please try again.');
    }
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
      this.showScreen('done');
    } catch (err) {
      alert('Failed to save. Please try again.');
      this.showScreen('survey');
    }
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
