/* Runtime kecil untuk template layar Nawasena.
 * Template memakai sintaks yang sama dengan prototipe desain:
 *   {{nama}} / {{x.j}}                → teks atau atribut
 *   <sc-if value="{{kondisi}}">       → tampil kalau truthy
 *   <sc-for list="{{daftar}}" as="x"> → ulang untuk tiap item
 *   onClick="{{fungsi}}" onChange="{{fungsi}}" → event (onChange = setiap ketikan)
 * Nilai selalu dimasukkan sebagai teks (tidak pernah sebagai HTML), jadi aman dari XSS.
 */
(function () {
  'use strict';
  var POLA = /\{\{\s*([^}]+?)\s*\}\}/g;

  function ambil(ctx, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var neg = false;
    if (path.charAt(0) === '!') { neg = true; path = path.slice(1); }
    var v = path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, ctx);
    return neg ? !v : v;
  }

  function nilaiMentah(str, ctx) {
    var m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(str || '');
    return m ? ambil(ctx, m[1]) : str;
  }

  function sisip(str, ctx) {
    return String(str).replace(POLA, function (_, p) {
      var v = ambil(ctx, p);
      return (v == null || typeof v === 'function' || v === false) ? '' : String(v);
    });
  }

  function Runtime(root, templateHtml) {
    var t = document.createElement('template');
    t.innerHTML = templateHtml;
    this.frag = t.content;
    this.root = root;
    this.daftarFn = [];
    var self = this;
    function cari(e, attr) {
      var el = e.target;
      while (el && el !== root) {
        if (el.nodeType === 1 && el.hasAttribute(attr)) return el;
        el = el.parentNode;
      }
      return null;
    }
    root.addEventListener('click', function (e) {
      var el = cari(e, 'data-on-click');
      if (!el) return;
      var fn = self.daftarFn[+el.getAttribute('data-on-click')];
      if (typeof fn === 'function') fn(e);
    });
    root.addEventListener('input', function (e) {
      var el = cari(e, 'data-on-change');
      if (!el) return;
      var fn = self.daftarFn[+el.getAttribute('data-on-change')];
      if (typeof fn === 'function') fn(e);
    });
  }

  Runtime.prototype.bangun = function (node, ctx, out) {
    var self = this;
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        var tx = c.nodeValue;
        if (/^\s*$/.test(tx) && tx.indexOf('\n') >= 0) continue; // spasi dari perapian file
        out.appendChild(document.createTextNode(tx.indexOf('{{') >= 0 ? sisip(tx, ctx) : tx));
        continue;
      }
      if (c.nodeType !== 1) continue;
      var tag = c.localName;
      if (tag === 'sc-if') {
        if (nilaiMentah(c.getAttribute('value'), ctx)) this.bangun(c, ctx, out);
        continue;
      }
      if (tag === 'sc-for') {
        var list = nilaiMentah(c.getAttribute('list'), ctx) || [];
        var as = c.getAttribute('as') || 'x';
        for (var i = 0; i < list.length; i++) {
          var sub = Object.create(ctx);
          sub[as] = list[i];
          sub[as + 'Index'] = i;
          this.bangun(c, sub, out);
        }
        continue;
      }
      if (tag === 'helmet') continue;
      var el = c.namespaceURI && c.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(c.namespaceURI, c.tagName)
        : document.createElement(tag);
      var nilaiInput = null;
      for (var a = 0; a < c.attributes.length; a++) {
        var at = c.attributes[a], nm = at.name, v = at.value;
        var low = nm.toLowerCase();
        if (low === 'onclick' || low === 'onchange') {
          var fn = nilaiMentah(v, ctx);
          if (typeof fn === 'function') {
            el.setAttribute(low === 'onclick' ? 'data-on-click' : 'data-on-change', String(self.daftarFn.push(fn) - 1));
          }
          continue;
        }
        if (low === 'value' && (tag === 'input' || tag === 'textarea')) {
          nilaiInput = sisip(v, ctx);
          if (tag === 'input') el.setAttribute('value', nilaiInput);
          continue;
        }
        if (low === 'disabled' || low === 'checked' || low === 'hidden') {
          var bv = nilaiMentah(v, ctx);
          if (bv === true || (bv && bv !== 'false')) el.setAttribute(nm, '');
          continue;
        }
        el.setAttribute(nm, v.indexOf('{{') >= 0 ? sisip(v, ctx) : v);
      }
      this.bangun(c, ctx, el);
      if (nilaiInput !== null) el.value = nilaiInput;
      out.appendChild(el);
    }
  };

  Runtime.prototype.gantiTemplate = function (html) {
    var t = document.createElement('template');
    t.innerHTML = html;
    this.frag = t.content;
    this.root.innerHTML = '';
  };
  Runtime.prototype.render = function (vals, kunci) {
    this.daftarFn = [];
    var wadah = document.createElement('div');
    wadah.id = this.root.firstElementChild ? this.root.firstElementChild.id || 'layar' : 'layar';
    wadah.id = 'layar';
    this.bangun(this.frag, vals, wadah);
    if (!this.root.firstElementChild) { this.root.appendChild(wadah); this._kunci = kunci; return; }
    // Pindah layar: ganti isi seluruhnya, supaya tidak ada sisa layar lama yang tertinggal
    // (misalnya kalau DOM sempat diubah dari luar, seperti fitur terjemahan browser).
    if (kunci !== undefined && kunci !== this._kunci) {
      this._kunci = kunci;
      this.root.replaceChild(wadah, this.root.firstElementChild);
      return;
    }
    window.morphdom(this.root.firstElementChild, wadah, {
      onBeforeElUpdated: function (from, to) {
        // biarkan input file dan elemen yang ditandai tetap
        if (from.hasAttribute && from.hasAttribute('data-tetap')) return false;
        return true;
      }
    });
  };

  window.NawasenaRuntime = Runtime;
})();
