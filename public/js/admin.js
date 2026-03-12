const admin = {
  async loadDashboard() {
    try {
      const res = await fetch('/admin/results');
      const data = await res.json();
      this.renderRankedList(data.items, data.totalRespondents);
      // Auto-expand items that have consensus
      for (const item of data.items) {
        this.autoExpandIfConsensus(item.id);
      }
    } catch (err) {
      document.getElementById('ranked-list').innerHTML = '<p style="color:#c00">Failed to load.</p>';
    }
  },

  async autoExpandIfConsensus(itemId) {
    try {
      const res = await fetch('/admin/items/' + itemId + '/consensus');
      const consensus = await res.json();
      if (consensus) {
        const detail = document.getElementById('detail-' + itemId);
        if (detail) {
          detail.style.display = 'block';
          await this.loadItemDetail(itemId);
        }
      }
    } catch (e) {}
  },

  renderRankedList(items, totalRespondents) {
    document.getElementById('respondent-count').textContent =
      totalRespondents + ' response' + (totalRespondents !== 1 ? 's' : '') + ' submitted';

    const list = document.getElementById('ranked-list');
    if (items.length === 0 || totalRespondents === 0) {
      list.innerHTML = '<p style="color:var(--text-light)">No responses yet.</p>';
      return;
    }

    list.innerHTML = items.map((item, idx) => {
      const avg = item.avg_importance ? item.avg_importance.toFixed(1) : '\u2014';
      const categoryClass = this.categoryClass(item.category);
      return '<div class="rank-row" data-item-id="' + item.id + '">' +
        '<div class="rank-row-main" onclick="admin.toggleItem(' + item.id + ')">' +
        '<span class="rank-number">' + (idx + 1) + '</span>' +
        '<div class="rank-info">' +
        '<span class="rank-title">' + this.esc(item.title) + '</span>' +
        '<span class="category-badge ' + categoryClass + '">' + this.esc(item.category) + '</span>' +
        '</div>' +
        '<div class="rank-score">' +
        '<span class="score-badge">' + avg + '</span>' +
        '<span class="response-count">' + item.response_count + ' rated</span>' +
        '</div>' +
        '</div>' +
        '<div class="rank-detail" id="detail-' + item.id + '" style="display:none;"></div>' +
        '</div>';
    }).join('');
  },

  categoryClass(cat) {
    if (cat.includes('Facilities')) return 'cat-facilities';
    if (cat.includes('Faith')) return 'cat-faith';
    if (cat.includes('User')) return 'cat-ux';
    if (cat.includes('Culture')) return 'cat-culture';
    return '';
  },

  async toggleItem(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    if (detail.style.display === 'none') {
      detail.style.display = 'block';
      await this.loadItemDetail(itemId);
    } else {
      detail.style.display = 'none';
    }
  },

  async loadItemDetail(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    detail.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';

    try {
      const [responsesRes, consensusRes] = await Promise.all([
        fetch('/admin/items/' + itemId + '/responses'),
        fetch('/admin/items/' + itemId + '/consensus')
      ]);
      const responses = await responsesRes.json();
      const consensus = await consensusRes.json();

      let html = '';

      html += '<div class="consensus-section">';
      if (consensus) {
        html += this.renderConsensus(consensus);
      }
      html += '<button class="btn btn-secondary admin-btn" onclick="admin.generateConsensus(' + itemId + ')">' +
        (consensus ? 'Regenerate' : 'Generate') + ' Consensus</button>';
      html += '</div>';

      html += '<div class="responses-section"><h4>Individual Responses</h4>';
      if (responses.length === 0) {
        html += '<p style="color:var(--text-light)">No responses yet.</p>';
      } else {
        responses.forEach(r => {
          const name = r.name || 'Anonymous';
          html += '<div class="response-card">' +
            '<div class="response-header"><span class="response-name">' + this.esc(name) + '</span>' +
            '<span class="response-importance">Importance: ' + r.importance + '/5</span></div>';
          if (r.definition_of_done) {
            html += '<p class="response-dod">' + this.esc(r.definition_of_done) + '</p>';
          } else {
            html += '<p class="response-dod" style="color:var(--text-light); font-style:italic;">No definition provided</p>';
          }
          html += '</div>';
        });
      }
      html += '</div>';

      detail.innerHTML = html;
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed to load details.</p>';
    }
  },

  renderConsensus(data) {
    let html = '<div class="consensus-box">';
    html += '<h4>Consensus Definition of Done</h4>';
    html += '<div class="consensus-definition">' + this.formatDoD(data.consensusDefinition) + '</div>';
    if (data.commonThemes && data.commonThemes.length) {
      html += '<div class="consensus-themes"><strong>Common Themes:</strong> ' +
        data.commonThemes.map(t => this.esc(t)).join(', ') + '</div>';
    }
    if (data.disagreements && data.disagreements.length) {
      html += '<div class="consensus-disagreements"><strong>Disagreements:</strong><ul>';
      data.disagreements.forEach(d => { html += '<li>' + this.esc(d) + '</li>'; });
      html += '</ul></div>';
    }
    if (data.outliers && data.outliers.length) {
      html += '<div class="consensus-disagreements"><strong>Outliers:</strong><ul>';
      data.outliers.forEach(function(o) { html += '<li>' + admin.esc(o) + '</li>'; });
      html += '</ul></div>';
    }
    var conf = data.confidence;
    var confDisplay = typeof conf === 'number' ? conf + '%' : this.esc(String(conf));
    var confColor = typeof conf === 'number' ? this.confidenceColor(conf) : 'var(--primary)';
    html += '<div class="consensus-confidence" style="color:' + confColor + '">Confidence: ' + confDisplay + '</div>';
    html += '</div>';
    return html;
  },

  async generateConsensus(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    const consensusSection = detail.querySelector('.consensus-section');
    if (consensusSection) {
      consensusSection.innerHTML = '<div class="results-loading"><div class="spinner"></div><p>Generating consensus...</p></div>';
    }

    try {
      const res = await fetch('/admin/items/' + itemId + '/consensus', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        if (consensusSection) consensusSection.innerHTML = '<p style="color:#c00">' + this.esc(data.error) + '</p>';
        return;
      }
      await this.loadItemDetail(itemId);
    } catch (err) {
      if (consensusSection) consensusSection.innerHTML = '<p style="color:#c00">Failed to generate.</p>';
    }
  },

  async generateAll() {
    // Switch to Rankings tab if not already there
    this.switchTab('rankings');

    const detail = document.getElementById('admin-detail');
    detail.innerHTML = '<div class="results-loading"><div class="spinner"></div><p>Generating consensus for all items... This may take a minute.</p></div>';
    detail.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
      const res = await fetch('/admin/consensus/all', { method: 'POST' });
      const data = await res.json();
      var html = '<div class="result-section">';
      html += '<p><strong>' + data.generated + '</strong> of ' + data.total + ' items got consensus.</p>';
      if (data.skipped > 0) {
        html += '<p style="color:var(--text-light); margin-top:0.5rem;">' + data.skipped +
          ' items skipped — need at least 1 written Definition of Done per item to generate consensus.</p>';
      }
      if (data.errors.length > 0) {
        html += '<p style="color:#c00; margin-top:0.5rem;">' + data.errors.length + ' items failed to generate.</p>';
      }
      html += '</div>';
      detail.innerHTML = html;
      detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.loadDashboard();
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed.</p>';
    }
  },

  async clearAll() {
    if (!confirm('Delete ALL respondents, responses, and AI results? This cannot be undone.')) return;
    if (!confirm('Are you sure? This will wipe everything.')) return;
    try {
      const res = await fetch('/admin/clear-all', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const detail = document.getElementById('admin-detail');
        detail.textContent = 'All entries cleared.';
        this.loadDashboard();
      } else {
        alert('Failed to clear.');
      }
    } catch (err) {
      alert('Failed to clear.');
    }
  },

  switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.admin-tab[onclick*="' + tab + '"]').classList.add('active');
    document.getElementById('tab-rankings').style.display = tab === 'rankings' ? 'block' : 'none';
    document.getElementById('tab-analysis').style.display = tab === 'analysis' ? 'block' : 'none';
    document.getElementById('tab-timeline').style.display = tab === 'timeline' ? 'block' : 'none';
    document.getElementById('tab-responses').style.display = tab === 'responses' ? 'block' : 'none';
    if (tab === 'analysis') this.loadAnalysis();
    if (tab === 'timeline') this.loadTimeline();
    if (tab === 'responses') this.loadResponses();
  },

  async refreshDashboard() {
    var btn = document.getElementById('refresh-btn');
    btn.textContent = 'Refreshing...';
    btn.disabled = true;
    await this.loadDashboard();
    btn.textContent = 'Refresh';
    btn.disabled = false;
  },

  async loadTimeline() {
    var container = document.getElementById('timeline-content');
    container.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';
    try {
      var res = await fetch('/admin/timeline');
      var data = await res.json();
      this.renderTimeline(data);
    } catch (err) {
      container.innerHTML = '<p style="color:#c00">Failed to load timeline.</p>';
    }
  },

  renderTimeline(submissions) {
    var container = document.getElementById('timeline-content');
    if (submissions.length === 0) {
      container.innerHTML = '<div class="analysis-section"><p style="color:var(--text-light)">No submissions yet.</p></div>';
      return;
    }
    var html = '<div class="analysis-section"><h3>Submission Timeline</h3>';
    submissions.forEach(function(s) {
      var name = s.name || 'Anonymous';
      var date = new Date(s.completed_at + 'Z');
      var formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ', ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      html += '<div class="timeline-row">' +
        '<span class="timeline-name">' + admin.esc(name) + '</span>' +
        '<span class="timeline-date">' + formatted + '</span>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  },

  async loadAnalysis() {
    var container = document.getElementById('analysis-content');
    container.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';
    try {
      var res = await fetch('/admin/analysis');
      var data = await res.json();
      this.renderAnalysis(data);
    } catch (err) {
      container.innerHTML = '<p style="color:#c00">Failed to load analysis.</p>';
    }
  },

  renderAnalysis(data) {
    var container = document.getElementById('analysis-content');
    var html = '';

    // Category Rankings
    html += '<div class="analysis-section">';
    html += '<h3>Category Priority Rankings</h3>';
    if (data.categoryStats.length === 0) {
      html += '<p style="color:var(--text-light)">No data yet.</p>';
    } else {
      data.categoryStats.forEach(function(cat, idx) {
        var avg = cat.avg_importance || 0;
        var pct = (avg / 5) * 100;
        var color = admin.scoreColor(avg, 5);
        var categoryClass = admin.categoryClass(cat.category);
        html += '<div class="analysis-row">' +
          '<div class="analysis-row-left">' +
          '<span class="rank-number">' + (idx + 1) + '</span>' +
          '<span class="category-badge ' + categoryClass + '">' + admin.esc(cat.category) + '</span>' +
          '</div>' +
          '<div class="analysis-bar-wrap">' +
          '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
          '</div>' +
          '<span class="analysis-value" style="color:' + color + '">' + avg.toFixed(1) + '</span>' +
          '<span class="analysis-meta">' + cat.item_count + ' items, ' + cat.total_ratings + ' ratings</span>' +
          '</div>';
      });
    }
    html += '</div>';

    // Top 5
    html += '<div class="analysis-section">';
    html += '<h3>Top 5 Highest Priority</h3>';
    html += this.renderItemList(data.top5);
    html += '</div>';

    // Bottom 5
    html += '<div class="analysis-section">';
    html += '<h3>Bottom 5 Lowest Priority</h3>';
    html += this.renderItemList(data.bottom5);
    html += '</div>';

    // DoD Coverage
    html += '<div class="analysis-section">';
    html += '<h3>Definition of Done Coverage</h3>';
    var cov = data.dodCoverage;
    var covColor = this.scoreColor(cov.pct, 100);
    html += '<div class="coverage-stat">' +
      '<div class="coverage-ring" style="--pct:' + cov.pct + '%;--ring-color:' + covColor + '">' +
      '<span class="coverage-pct">' + cov.pct + '%</span>' +
      '</div>' +
      '<div class="coverage-detail">' +
      '<p><strong>' + cov.withDod + '</strong> of <strong>' + cov.total + '</strong> responses include a Definition of Done</p>' +
      '</div>' +
      '</div>';
    html += '</div>';

    // IDK Report
    if (data.idkStats.length > 0) {
      html += '<div class="analysis-section">';
      html += '<h3>Items With Most "I Don\'t Know" Responses</h3>';
      data.idkStats.forEach(function(item) {
        var pct = item.total_responses > 0 ? Math.round((item.idk_count / item.total_responses) * 100) : 0;
        var color = admin.scoreColor(100 - pct, 100);
        var categoryClass = admin.categoryClass(item.category);
        html += '<div class="analysis-row">' +
          '<div class="analysis-row-left">' +
          '<span class="category-badge ' + categoryClass + '" style="font-size:0.7rem">' + admin.esc(item.category) + '</span>' +
          '<span class="analysis-item-title">' + admin.esc(item.title) + '</span>' +
          '</div>' +
          '<div class="analysis-bar-wrap">' +
          '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
          '</div>' +
          '<span class="analysis-value" style="color:' + color + '">' + item.idk_count + '/' + item.total_responses + '</span>' +
          '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  renderItemList(items) {
    if (!items || items.length === 0) return '<p style="color:var(--text-light)">No data yet.</p>';
    var html = '';
    items.forEach(function(item, idx) {
      var avg = item.avg_importance || 0;
      var pct = (avg / 5) * 100;
      var color = admin.scoreColor(avg, 5);
      var categoryClass = admin.categoryClass(item.category);
      html += '<div class="analysis-row">' +
        '<div class="analysis-row-left">' +
        '<span class="rank-number">' + (idx + 1) + '</span>' +
        '<span class="category-badge ' + categoryClass + '" style="font-size:0.7rem">' + admin.esc(item.category) + '</span>' +
        '<span class="analysis-item-title">' + admin.esc(item.title) + '</span>' +
        '</div>' +
        '<div class="analysis-bar-wrap">' +
        '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
        '</div>' +
        '<span class="analysis-value" style="color:' + color + '">' + avg.toFixed(1) + '</span>' +
        '</div>';
    });
    return html;
  },

  // === Responses Tab ===
  async loadResponses() {
    var container = document.getElementById('responses-content');
    container.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';
    try {
      var res = await fetch('/admin/respondents');
      var data = await res.json();
      var completed = data.filter(function(r) { return r.completed_at; });
      this.renderRespondentList(completed);
    } catch (err) {
      container.innerHTML = '<p style="color:#c00">Failed to load responses.</p>';
    }
  },

  renderRespondentList(respondents) {
    var container = document.getElementById('responses-content');
    if (respondents.length === 0) {
      container.innerHTML = '<div class="analysis-section"><p style="color:var(--text-light)">No completed responses yet.</p></div>';
      return;
    }
    var html = '';
    respondents.forEach(function(r) {
      var name = r.name || 'Anonymous';
      var date = new Date(r.completed_at + 'Z');
      var formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ', ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      html += '<div class="respondent-row" data-respondent-id="' + r.id + '">' +
        '<div class="respondent-row-main" onclick="admin.toggleRespondent(\'' + r.id + '\')">' +
          '<div class="respondent-info">' +
            '<span class="respondent-name">' + admin.esc(name) + '</span>' +
            '<span class="respondent-date">' + formatted + '</span>' +
          '</div>' +
          '<button class="btn btn-danger admin-btn" onclick="event.stopPropagation(); admin.deleteRespondent(\'' + r.id + '\', \'' + admin.esc(name).replace(/'/g, "\\'") + '\')" style="font-size:0.75rem;padding:0.3rem 0.6rem;">Delete</button>' +
        '</div>' +
        '<div class="respondent-detail" id="respondent-detail-' + r.id + '" style="display:none;"></div>' +
      '</div>';
    });
    container.innerHTML = html;
  },

  async toggleRespondent(id) {
    var detail = document.getElementById('respondent-detail-' + id);
    if (detail.style.display === 'none') {
      detail.style.display = 'block';
      await this.loadRespondentDetail(id);
    } else {
      detail.style.display = 'none';
    }
  },

  async loadRespondentDetail(id) {
    var detail = document.getElementById('respondent-detail-' + id);
    detail.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';
    try {
      var res = await fetch('/admin/respondents/' + id + '/responses');
      var data = await res.json();
      this.renderRespondentResponses(id, data.responses);
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed to load.</p>';
    }
  },

  renderRespondentResponses(respondentId, responses) {
    var detail = document.getElementById('respondent-detail-' + respondentId);
    if (responses.length === 0) {
      detail.innerHTML = '<p style="color:var(--text-light);padding:1rem;">No responses recorded.</p>';
      return;
    }

    var categories = {};
    responses.forEach(function(r) {
      if (!categories[r.category]) categories[r.category] = [];
      categories[r.category].push(r);
    });

    var html = '';
    for (var cat in categories) {
      var catClass = admin.categoryClass(cat);
      html += '<div class="resp-category-group">' +
        '<span class="category-badge ' + catClass + '" style="font-size:0.75rem;margin-bottom:0.5rem;display:inline-block;">' + admin.esc(cat) + '</span>';
      categories[cat].forEach(function(r) {
        var color = admin.importanceColor(r.importance);
        var dod = r.definition_of_done || '';
        var dodDisplay = dod ? admin.esc(dod) : '<em style="color:var(--text-light)">No definition provided</em>';
        html += '<div class="resp-item" id="resp-item-' + r.response_id + '">' +
          '<div class="resp-item-header">' +
            '<span class="resp-item-title">' + admin.esc(r.title) + '</span>' +
            '<div class="resp-item-right">' +
              '<span class="resp-importance-badge" style="background:' + color + '">' + r.importance + '</span>' +
              '<button class="btn btn-secondary admin-btn" onclick="admin.editResponse(' + r.response_id + ', ' + r.importance + ', ' + JSON.stringify(dod).replace(/"/g, '&quot;') + ')" style="font-size:0.7rem;padding:0.2rem 0.5rem;">Edit</button>' +
            '</div>' +
          '</div>' +
          '<div class="resp-item-dod">' + dodDisplay + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    detail.innerHTML = html;
  },

  editResponse(responseId, currentImportance, currentDod) {
    var item = document.getElementById('resp-item-' + responseId);
    if (!item) return;
    var dodArea = item.querySelector('.resp-item-dod');
    var headerRight = item.querySelector('.resp-item-right');

    // Build importance selector
    var impHtml = '';
    for (var i = 1; i <= 5; i++) {
      var sel = i === currentImportance ? ' selected' : '';
      impHtml += '<option value="' + i + '"' + sel + '>' + i + '</option>';
    }

    headerRight.innerHTML =
      '<select id="edit-imp-' + responseId + '" class="edit-importance-select">' + impHtml + '</select>' +
      '<button class="btn btn-primary admin-btn" onclick="admin.saveResponse(' + responseId + ')" style="font-size:0.7rem;padding:0.2rem 0.5rem;">Save</button>' +
      '<button class="btn btn-secondary admin-btn" onclick="admin.cancelEditResponse(\'' + responseId + '\')" style="font-size:0.7rem;padding:0.2rem 0.5rem;">Cancel</button>';

    dodArea.innerHTML = '<textarea class="open-text" id="edit-dod-' + responseId + '" style="min-height:60px;font-size:0.85rem;">' + this.esc(currentDod) + '</textarea>';
  },

  async saveResponse(responseId) {
    var impEl = document.getElementById('edit-imp-' + responseId);
    var dodEl = document.getElementById('edit-dod-' + responseId);
    if (!impEl || !dodEl) return;

    var importance = parseInt(impEl.value, 10);
    var dod = dodEl.value.trim();

    try {
      var res = await fetch('/admin/responses/' + responseId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importance: importance, definition_of_done: dod || null })
      });
      var data = await res.json();
      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }
      // Reload the respondent's detail
      var row = document.getElementById('resp-item-' + responseId).closest('.respondent-detail');
      if (row) {
        var respondentId = row.id.replace('respondent-detail-', '');
        await this.loadRespondentDetail(respondentId);
      }
    } catch (err) {
      alert('Failed to save.');
    }
  },

  cancelEditResponse(responseId) {
    // Find the respondent and reload
    var item = document.getElementById('resp-item-' + responseId);
    if (!item) return;
    var row = item.closest('.respondent-detail');
    if (row) {
      var respondentId = row.id.replace('respondent-detail-', '');
      this.loadRespondentDetail(respondentId);
    }
  },

  async deleteRespondent(id, name) {
    if (!confirm('Delete all responses from ' + name + '? This cannot be undone.')) return;
    try {
      var res = await fetch('/admin/respondents/' + id, { method: 'DELETE' });
      var data = await res.json();
      if (data.ok) {
        this.loadResponses();
      } else {
        alert('Failed to delete.');
      }
    } catch (err) {
      alert('Failed to delete.');
    }
  },

  importanceColor(val) {
    var colors = { 1: '#DC2626', 2: '#F97316', 3: '#EAB308', 4: '#22C55E', 5: '#16A34A' };
    return colors[val] || '#94A3B8';
  },

  scoreColor(value, max) {
    var ratio = max > 0 ? value / max : 0;
    var r = Math.round(220 - ratio * 180);
    var g = Math.round(60 + ratio * 140);
    var b = 60;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  formatDoD(text) {
    if (!text) return '';
    var escaped = this.esc(text);
    // If it has bullet points (- or *), render as a list
    var lines = escaped.split(/\n/).filter(function(l) { return l.trim(); });
    var hasBullets = lines.some(function(l) { return /^\s*[-*]\s/.test(l); });
    if (hasBullets) {
      var items = lines.map(function(l) {
        return '<li>' + l.replace(/^\s*[-*]\s*/, '') + '</li>';
      }).join('');
      return '<ul class="dod-checklist">' + items + '</ul>';
    }
    return '<p>' + escaped + '</p>';
  },

  toggleExportMenu() {
    var menu = document.getElementById('export-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  confidenceColor(val) {
    if (val >= 80) return '#15803D';  // dark green
    if (val >= 60) return '#CA8A04';  // dark yellow/amber
    if (val >= 40) return '#C2410C';  // dark orange
    return '#B91C1C';                 // dark red
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
};

// Close export menu when clicking outside
document.addEventListener('click', function(e) {
  var menu = document.getElementById('export-menu');
  if (menu && menu.style.display !== 'none') {
    if (!e.target.closest('#export-menu') && !e.target.closest('[onclick*="toggleExportMenu"]')) {
      menu.style.display = 'none';
    }
  }
});

document.addEventListener('DOMContentLoaded', () => admin.loadDashboard());
