/* IT Hangman: guess IT terms letter by letter, learn what they mean afterwards */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  const CATS = {
    net: { name: 'Networking', short: 'Network', icon: 'fas fa-network-wired' },
    ops: { name: 'Sysadmin', short: 'Sysadmin', icon: 'fas fa-server' },
    code: { name: 'Programming', short: 'Code', icon: 'fas fa-code' },
    hw: { name: 'Hardware', short: 'Hardware', icon: 'fas fa-microchip' },
    sec: { name: 'Security', short: 'Security', icon: 'fas fa-shield-halved' }
  };
  const WORDS = {
    net: [
      ['Router', 'Forwards packets between different networks, for example your LAN and the internet.'],
      ['Switch', 'Connects devices inside one network and forwards frames by MAC address.'],
      ['Subnet', 'A slice of an IP network, defined by a prefix such as /24.'],
      ['Gateway', 'The router a device sends traffic to when the destination is outside its own subnet.'],
      ['DHCP', 'Hands out IP addresses, gateway and DNS servers to devices automatically.'],
      ['DNS', 'The phone book of the internet: turns names like example.com into IP addresses.'],
      ['NAT', 'Network Address Translation: many private addresses share one public IP.'],
      ['VLAN', 'Splits one physical switch into several separate logical networks.'],
      ['TCP', 'Reliable, connection-based transport with handshakes, ordering and retransmits.'],
      ['UDP', 'Fast, connectionless transport without delivery guarantees; used for DNS, games and VoIP.'],
      ['ICMP', 'Control messages for IP networks; ping and traceroute are built on it.'],
      ['ARP', 'Finds the MAC address that belongs to an IPv4 address on the local network.'],
      ['Latency', 'How long a packet takes to get from A to B, usually measured in milliseconds.'],
      ['Bandwidth', 'The maximum amount of data a link can carry per second.'],
      ['Packet', 'A small chunk of data with a header that says where it comes from and where it goes.'],
      ['Ethernet', 'The standard for wired local networks, from the cable to the frame format.'],
      ['Traceroute', 'Shows every router hop on the way to a destination.'],
      ['Ping', 'Sends ICMP echo requests to check whether a host answers and how fast.'],
      ['Proxy', 'A server that makes requests on behalf of clients, often for caching or filtering.'],
      ['Port', 'A number from 0 to 65535 that identifies a service on a host, like 443 for HTTPS.'],
      ['MAC address', 'The hardware address of a network interface, written as six hex pairs.'],
      ['IPv6', 'The 128-bit successor of IPv4, written in hexadecimal groups separated by colons.'],
      ['Hostname', 'The human-readable name of a device on a network.'],
      ['Loopback', 'The address a machine uses to talk to itself: 127.0.0.1 or ::1.'],
      ['Broadcast', 'A message sent to every device in the local network segment.'],
      ['Multicast', 'One sender, a group of interested receivers, for example IPTV streams.'],
      ['Netmask', 'Marks which part of an IP address is the network and which part is the host.'],
      ['Access point', 'Lets wireless devices join a wired network.'],
      ['OSPF', 'A link-state routing protocol that finds the shortest paths inside one organisation.'],
      ['BGP', 'The routing protocol that glues the networks of the internet together.'],
      ['Spanning tree', 'A switch protocol that blocks redundant links so frames do not loop forever.'],
      ['Trunk', 'A switch link that carries several VLANs at once, tagged with 802.1Q.'],
      ['MTU', 'The largest packet size a link can carry without fragmenting, often 1500 bytes.'],
      ['Handshake', 'The SYN, SYN-ACK, ACK exchange that opens a TCP connection.'],
      ['Socket', 'One end of a network connection: an IP address plus a port.'],
      ['Throughput', 'How much data actually gets through per second, as opposed to the theoretical bandwidth.'],
      ['Jitter', 'Variation in latency; bad news for voice and video calls.'],
      ['Topology', 'The layout of a network: star, ring, mesh, bus and so on.'],
      ['Firewall rule', 'One line in a firewall policy that allows or blocks matching traffic.'],
      ['Default route', 'The route used when no more specific route matches: 0.0.0.0/0.'],
      ['Fiber optic', 'Cable that carries data as light through glass, fast and over long distances.'],
      ['WLAN', 'A wireless local area network, usually Wi-Fi.']
    ],
    ops: [
      ['Backup', 'A copy of data kept somewhere else so you can restore it after a loss.'],
      ['Cron', 'The Unix scheduler that runs commands at fixed times, configured in a crontab.'],
      ['Daemon', 'A background process on Unix systems, often with a name ending in d, like sshd.'],
      ['Kernel', 'The core of the operating system that talks to the hardware and manages processes.'],
      ['Shell', 'The command line interpreter, such as bash, zsh or PowerShell.'],
      ['Sudo', 'Runs a single command with root privileges on Linux.'],
      ['Chmod', 'Changes the read, write and execute permissions of a file.'],
      ['Inode', 'The structure that stores a file\'s metadata on Unix file systems.'],
      ['Mount', 'Attaches a file system to a folder in the directory tree.'],
      ['Partition', 'A separate section of a disk with its own file system.'],
      ['Swap', 'Disk space used as overflow memory when RAM runs out.'],
      ['Uptime', 'How long a system has been running since its last reboot.'],
      ['Systemd', 'The init system and service manager of most modern Linux distributions.'],
      ['Journalctl', 'Reads the systemd journal, the central log on modern Linux systems.'],
      ['Logrotate', 'Rotates, compresses and deletes old log files so disks do not fill up.'],
      ['Hypervisor', 'Software that runs virtual machines, such as Hyper-V, KVM or ESXi.'],
      ['Container', 'A lightweight, isolated environment that shares the host kernel.'],
      ['Docker', 'The popular tool for building and running containers from images.'],
      ['Kubernetes', 'Orchestrates containers across a cluster: scheduling, scaling and self-healing.'],
      ['Ansible', 'Agentless automation that configures servers over SSH with YAML playbooks.'],
      ['Snapshot', 'A frozen point-in-time state of a disk or VM you can roll back to.'],
      ['RAID', 'Combines several disks for redundancy, speed or both.'],
      ['Active Directory', 'Microsoft\'s directory service for users, computers and policies in a domain.'],
      ['Group Policy', 'Central settings that Windows domain computers and users receive from AD.'],
      ['PowerShell', 'Microsoft\'s object-based shell and scripting language.'],
      ['Registry', 'The hierarchical database where Windows and its programs store settings.'],
      ['Load balancer', 'Spreads incoming requests over several servers.'],
      ['Failover', 'Switching automatically to a standby system when the primary one fails.'],
      ['Cluster', 'A group of servers that work together and look like one system.'],
      ['Rollback', 'Going back to the previous working version after a bad change.'],
      ['Monitoring', 'Watching systems and services continuously and alerting when something breaks.'],
      ['Grafana', 'An open source dashboard tool for metrics, logs and alerts.'],
      ['Syslog', 'The classic standard for sending log messages over the network.'],
      ['SSH', 'Secure Shell: encrypted remote login and command execution.'],
      ['Virtual machine', 'A complete computer emulated in software, with its own OS.'],
      ['Quota', 'A limit on how much disk space a user or group may use.'],
      ['Environment variable', 'A named value like PATH that processes inherit from their parent.'],
      ['Patch Tuesday', 'The second Tuesday of the month, when Microsoft releases security updates.'],
      ['Runbook', 'Step-by-step instructions for routine or emergency operations tasks.'],
      ['Hotfix', 'A quick, targeted fix shipped straight to production.'],
      ['Deployment', 'Rolling out a new version of software to servers or users.'],
      ['Provisioning', 'Setting up new servers, accounts or resources so they are ready to use.']
    ],
    code: [
      ['Variable', 'A named place in memory that holds a value.'],
      ['Function', 'A reusable block of code that takes inputs and returns a result.'],
      ['Recursion', 'A function that calls itself to solve smaller copies of the same problem.'],
      ['Compiler', 'Translates source code into machine code or bytecode before it runs.'],
      ['Interpreter', 'Runs source code directly, line by line, without a separate build step.'],
      ['Debugger', 'Lets you pause a program, step through it and inspect its variables.'],
      ['Boolean', 'A value that is either true or false.'],
      ['Integer', 'A whole number without a fractional part.'],
      ['String', 'A sequence of characters, in other words text.'],
      ['Array', 'An ordered list of values accessed by index.'],
      ['Pointer', 'A variable that stores the memory address of another value.'],
      ['Closure', 'A function that remembers the variables of the scope it was created in.'],
      ['Callback', 'A function you pass to other code so it can call you back later.'],
      ['Promise', 'A placeholder for a result that will be available in the future.'],
      ['Async', 'Code that starts work and continues without waiting for it to finish.'],
      ['Exception', 'An error that interrupts the normal flow until something catches it.'],
      ['Refactoring', 'Restructuring code without changing what it does.'],
      ['Repository', 'A project folder tracked by version control, including its full history.'],
      ['Commit', 'A saved snapshot of changes in Git, with a message and an author.'],
      ['Merge', 'Combining the changes of two branches into one.'],
      ['Branch', 'An independent line of development in a Git repository.'],
      ['Rebase', 'Replays your commits on top of another branch to get a straight history.'],
      ['Regex', 'A regular expression: a small pattern language for matching text.'],
      ['JSON', 'A lightweight text format for data, based on JavaScript object syntax.'],
      ['API', 'An interface that lets programs talk to each other.'],
      ['Framework', 'A skeleton that calls your code, like React, Django or Spring.'],
      ['Library', 'A collection of code you call when you need it.'],
      ['Iterator', 'An object that walks through a collection one item at a time.'],
      ['Lambda', 'A small anonymous function, often written inline.'],
      ['Polymorphism', 'Different types answering the same method call in their own way.'],
      ['Inheritance', 'A class taking over the fields and methods of a parent class.'],
      ['Encapsulation', 'Hiding internal state behind a public interface.'],
      ['Algorithm', 'A precise sequence of steps that solves a problem.'],
      ['Hash map', 'A key-value store with near constant-time lookups.'],
      ['Stack', 'Last in, first out: you push on top and pop from the top.'],
      ['Queue', 'First in, first out, like a line at the bakery.'],
      ['Linked list', 'A chain of nodes where each node points to the next one.'],
      ['Unit test', 'A small automated test that checks one piece of code in isolation.'],
      ['Linter', 'A tool that flags suspicious code and style problems without running the program.'],
      ['Syntax error', 'Code that breaks the grammar of the language, so it cannot even be parsed.'],
      ['Deadlock', 'Two threads each waiting for a lock the other one holds, forever.'],
      ['Mutex', 'A lock that lets only one thread at a time into a critical section.'],
      ['Garbage collection', 'Automatic freeing of memory that is no longer reachable.']
    ],
    hw: [
      ['Motherboard', 'The main circuit board that connects CPU, memory, storage and expansion cards.'],
      ['Processor', 'The CPU: executes the instructions of every program.'],
      ['Chipset', 'Controls the data flow between the CPU, memory and peripherals on a motherboard.'],
      ['Heatsink', 'A block of metal fins that pulls heat away from a chip.'],
      ['Thermal paste', 'Fills the tiny gaps between a CPU and its cooler so heat transfers well.'],
      ['Power supply', 'Converts mains AC into the DC voltages a computer needs.'],
      ['SSD', 'Solid state drive: flash storage without moving parts.'],
      ['NVMe', 'A protocol that lets SSDs talk directly over PCIe, much faster than SATA.'],
      ['Hard drive', 'Stores data magnetically on spinning platters.'],
      ['RAM', 'Fast, volatile working memory that is wiped when the power goes off.'],
      ['Cache', 'A small, very fast memory close to the CPU that keeps recently used data.'],
      ['BIOS', 'The old firmware that starts a PC and hands control to the operating system.'],
      ['UEFI', 'The modern replacement for BIOS, with Secure Boot and GPT disks.'],
      ['GPU', 'The graphics processor, also great at massively parallel math.'],
      ['PCIe', 'The high-speed expansion bus for graphics cards, NVMe drives and network cards.'],
      ['SATA', 'The interface for connecting hard drives and older SSDs.'],
      ['USB', 'Universal Serial Bus: the standard port for peripherals and charging.'],
      ['Firmware', 'Low-level software stored on a device that controls its hardware.'],
      ['Overclocking', 'Running a chip faster than its rated speed, at the cost of heat and stability.'],
      ['Clock speed', 'How many cycles per second a processor runs, measured in gigahertz.'],
      ['Core', 'An independent processing unit inside a CPU.'],
      ['Thread', 'A sequence of instructions a core can run; hyper-threading runs two per core.'],
      ['Peripheral', 'Any device attached to a computer, like a keyboard, mouse or printer.'],
      ['Network card', 'The NIC: the hardware that connects a computer to a network.'],
      ['Raspberry Pi', 'A credit-card-sized single-board computer, popular for home projects.'],
      ['Microcontroller', 'A tiny computer on one chip for embedded jobs, like an Arduino or ESP32.'],
      ['Transistor', 'An electronic switch; billions of them make up a modern processor.'],
      ['Capacitor', 'Stores electrical charge and smooths out voltage.'],
      ['Resistor', 'Limits the current flowing through a circuit.'],
      ['Soldering', 'Joining electronic parts with molten metal.'],
      ['Breadboard', 'A board for building circuits without soldering.'],
      ['Server rack', 'A standard 19-inch frame that holds servers, switches and patch panels.'],
      ['Blade server', 'A thin server that slides into a shared chassis with power and cooling.'],
      ['UPS', 'Uninterruptible power supply: a battery that bridges power cuts.'],
      ['KVM switch', 'Lets one keyboard, monitor and mouse control several computers.'],
      ['ECC memory', 'RAM that detects and corrects single-bit errors; standard in servers.'],
      ['DIMM', 'The memory module you click into a desktop or server motherboard.'],
      ['Thunderbolt', 'A fast port for displays, docks and external drives over a USB-C connector.'],
      ['HDMI', 'The common cable for sending digital video and audio to screens.'],
      ['DisplayPort', 'A digital display interface, common on PCs and monitors.'],
      ['Patch panel', 'A panel of network ports where the building cabling ends.'],
      ['Mainframe', 'A large, very reliable computer for huge transaction workloads.']
    ],
    sec: [
      ['Phishing', 'Fake messages that trick people into giving away passwords or clicking malware.'],
      ['Malware', 'Any software written to harm, spy on or take over a system.'],
      ['Ransomware', 'Malware that encrypts your files and demands money for the key.'],
      ['Trojan', 'Malware that pretends to be something useful.'],
      ['Worm', 'Malware that spreads to other machines by itself.'],
      ['Botnet', 'A network of hijacked machines controlled by an attacker.'],
      ['Rootkit', 'Malware that hides deep in a system, often in the kernel.'],
      ['Keylogger', 'Records every key you press, including passwords.'],
      ['Exploit', 'Code or a technique that abuses a vulnerability.'],
      ['Zero day', 'A vulnerability that is attacked before a fix exists.'],
      ['Encryption', 'Scrambling data so only someone with the key can read it.'],
      ['Certificate', 'A signed file that proves a server\'s identity for TLS.'],
      ['Firewall', 'Filters network traffic according to rules.'],
      ['VPN', 'An encrypted tunnel into another network over the internet.'],
      ['Two factor', 'Logging in with something you know plus something you have.'],
      ['Password manager', 'Stores long, unique passwords for every account behind one master password.'],
      ['Hashing', 'A one-way function that turns data into a fixed-length fingerprint.'],
      ['Salt', 'Random data added to a password before hashing so equal passwords get different hashes.'],
      ['Brute force', 'Trying every possible password until one works.'],
      ['SQL injection', 'Smuggling SQL into an input field so the database runs it.'],
      ['Cross site scripting', 'XSS: injecting JavaScript into a page that other users load.'],
      ['Honeypot', 'A decoy system that lures attackers so you can watch them.'],
      ['Sandbox', 'An isolated environment where untrusted code cannot harm the rest of the system.'],
      ['Penetration test', 'An authorised, simulated attack to find weaknesses before real attackers do.'],
      ['Vulnerability', 'A weakness that an attacker could use.'],
      ['Backdoor', 'A hidden way into a system that bypasses normal authentication.'],
      ['Social engineering', 'Manipulating people instead of machines to get access.'],
      ['Least privilege', 'Give every account only the rights it really needs.'],
      ['Antivirus', 'Software that detects and removes known malware.'],
      ['Intrusion detection', 'An IDS watches network or host activity for signs of attacks.'],
      ['Denial of service', 'Flooding a service so real users cannot reach it.'],
      ['Man in the middle', 'An attacker secretly relaying and reading traffic between two parties.'],
      ['Spoofing', 'Faking a sender address, IP or identity.'],
      ['Cipher', 'An algorithm for encrypting and decrypting data, like AES.'],
      ['Public key', 'The half of a key pair you share; others use it to encrypt to you or check your signature.'],
      ['Private key', 'The half of a key pair you never share.'],
      ['Digital signature', 'Proves who sent a message and that it was not changed.'],
      ['Audit log', 'A tamper-resistant record of who did what and when.'],
      ['CVE', 'Common Vulnerabilities and Exposures: the public ID system for security flaws.'],
      ['Spyware', 'Software that secretly collects information about the user.'],
      ['Allowlist', 'Only what is explicitly listed is permitted; everything else is blocked.'],
      ['Packet sniffer', 'A tool like Wireshark that captures and shows network traffic.']
    ]
  };
  const ALL = Object.keys(WORDS).flatMap(c => WORDS[c].map(w => ({ term: w[0], text: w[1], cat: c })));
  const MAX = 7;
  const ROWS = ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'];

  let cat = store.get('hangman-cat', 'all');
  if (cat !== 'all' && !CATS[cat]) cat = 'all';
  let stats = Object.assign({ wins: 0, losses: 0, streak: 0, best: 0 }, store.get('hangman-stats', {}));
  let cur, guessed, misses, over, hintsUsed;
  const bags = {};

  function pick() {
    const pool = cat === 'all' ? ALL : ALL.filter(w => w.cat === cat);
    if (!bags[cat] || !bags[cat].length) {
      bags[cat] = pool.slice().sort(() => Math.random() - 0.5);
      if (cur && bags[cat].length > 1 && bags[cat][bags[cat].length - 1] === cur) bags[cat].unshift(bags[cat].pop());
    }
    return bags[cat].pop();
  }
  const letters = (t) => new Set(t.toUpperCase().replace(/[^A-Z]/g, '').split(''));

  function newWord() {
    cur = pick(); guessed = new Set(); misses = 0; over = false; hintsUsed = 0;
    const c = CATS[cur.cat];
    $('#cat').innerHTML = `<i class="${c.icon}"></i><span>${c.name}</span>`;
    $('#cat').style.animation = 'none'; void $('#cat').offsetWidth; $('#cat').style.animation = '';
    $('#fig').classList.remove('won', 'lost');
    $('#word').classList.remove('won');
    $('#result').hidden = true; $('#kb').hidden = false;
    $('#kb').classList.remove('done');
    $('#kb').querySelectorAll('button').forEach(b => { b.className = ''; b.disabled = false; });
    drawWord(); drawFig(); drawLives(); updButtons();
  }

  function drawWord(fresh) {
    const shown = (ch) => !/[A-Za-z]/.test(ch) || guessed.has(ch.toUpperCase());
    $('#word').style.setProperty('--n', Math.max(6, ...cur.term.split(' ').map(w => w.length)));
    $('#word').innerHTML = cur.term.split(' ').map(w => `<span class="hm-w">${w.split('').map(ch => {
      if (!/[A-Za-z]/.test(ch)) return `<span class="hm-l sym"><span>${esc(ch)}</span></span>`;
      const up = ch.toUpperCase();
      if (shown(ch)) return `<span class="hm-l shown"><span>${esc(up)}</span></span>`;
      if (over) return `<span class="hm-l miss"><span>${esc(up)}</span></span>`;
      return `<span class="hm-l"></span>`;
    }).join('')}</span>`).join('');
  }
  function revealLetter(L) {
    // slots are in the same order as the letters of the term (spaces are not slots)
    const chars = cur.term.replace(/ /g, '').toUpperCase().split('');
    $('#word').querySelectorAll('.hm-l').forEach((el, i) => { if (chars[i] === L) { el.classList.add('shown'); el.innerHTML = `<span>${L}</span>`; } });
  }
  function drawFig() {
    $('#fig').querySelectorAll('.hm-man .p').forEach((p, i) => p.classList.toggle('on', i < misses));
  }
  function drawLives() {
    $('#lives').innerHTML = Array.from({ length: MAX }, (_, i) => `<i class="${i < MAX - misses ? '' : 'gone'}"></i>`).join('');
    $('#lives').setAttribute('aria-label', `${MAX - misses} of ${MAX} lives left`);
  }
  function updButtons() {
    $('#hintBtn').disabled = over || misses >= MAX - 1;
  }
  function drawStats(popKey) {
    const set = (id, v, key) => { const el = $(id); el.querySelector('b').textContent = v; if (popKey === key) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } };
    set('#sWins', stats.wins, 'wins'); set('#sStreak', stats.streak, 'streak'); set('#sBest', stats.best, 'best');
  }

  function guess(L) {
    if (over || !cur) return;
    L = L.toUpperCase();
    if (!/^[A-Z]$/.test(L) || guessed.has(L)) return;
    guessed.add(L);
    const key = $(`#kb button[data-k="${L}"]`);
    const hit = letters(cur.term).has(L);
    if (key) { key.classList.add(hit ? 'hit' : 'miss'); key.disabled = true; }
    if (hit) revealLetter(L);
    else miss();
    check();
  }
  function miss() {
    misses++; drawFig(); drawLives(); updButtons();
    if (!Site.reduceMotion) { const s = $('.hm-stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  }
  function check() {
    const need = letters(cur.term);
    const won = [...need].every(l => guessed.has(l));
    if (won) return finish(true);
    if (misses >= MAX) return finish(false);
  }
  function finish(won) {
    over = true;
    if (won) { stats.wins++; stats.streak++; if (stats.streak > stats.best) stats.best = stats.streak; }
    else { stats.losses++; stats.streak = 0; }
    store.set('hangman-stats', stats);
    drawStats(won ? 'wins' : 'streak');
    $('#fig').classList.add(won ? 'won' : 'lost');
    if (won) $('#word').classList.add('won'); else drawWord();
    $('#kb').classList.add('done');
    $('#kb').querySelectorAll('button').forEach(b => { b.disabled = true; });
    updButtons();
    const st = $('#resStatus');
    st.className = 'status ' + (won ? 'ok' : 'err');
    st.innerHTML = won ? `<i class="fas fa-check"></i>Solved${misses ? ` with ${MAX - misses} ${MAX - misses === 1 ? 'life' : 'lives'} left` : ' without a mistake'}` : '<i class="fas fa-skull"></i>Out of lives';
    $('#resTerm').textContent = cur.term;
    $('#resText').textContent = cur.text;
    setTimeout(() => { if (!over) return; $('#kb').hidden = true; $('#result').hidden = false; $('#nextBtn').focus({ preventScroll: true }); }, Site.reduceMotion ? 0 : 650);
    if (won && stats.streak > 0 && stats.streak % 5 === 0) { Site.party(false); Site.toast(`${stats.streak} in a row!`, 'fas fa-fire'); }
  }
  function hint() {
    if (over || misses >= MAX - 1) return;
    const left = [...letters(cur.term)].filter(l => !guessed.has(l));
    if (!left.length) return;
    const L = left[(Math.random() * left.length) | 0];
    hintsUsed++;
    guessed.add(L);
    const key = $(`#kb button[data-k="${L}"]`); if (key) { key.classList.add('hit'); key.disabled = true; }
    revealLetter(L);
    miss();
    check();
  }
  function skip() {
    if (!over && guessed.size && stats.streak) { stats.streak = 0; store.set('hangman-stats', stats); drawStats('streak'); Site.toast('Skipped. Streak reset.', 'fas fa-shuffle'); }
    newWord();
  }

  // ---------- UI ----------
  $('#kb').innerHTML = ROWS.map(r => `<div class="r">${r.split('').map(k => `<button type="button" data-k="${k}" aria-label="${k}">${k}</button>`).join('')}</div>`).join('');
  $('#kb').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) guess(b.dataset.k); });
  const counts = (c) => c === 'all' ? ALL.length : WORDS[c].length;
  $('#cats').innerHTML = [['all', { short: 'All', icon: 'fas fa-shapes' }]].concat(Object.entries(CATS)).map(([k, c]) => `<button type="button" data-c="${k}" aria-pressed="${k === cat}"><i class="${c.icon}"></i>${c.short}</button>`).join('');
  const catHint = () => { $('#catHint').textContent = `${counts(cat)} terms ${cat === 'all' ? 'across all five categories' : 'in ' + CATS[cat].name}.`; };
  $('#cats').addEventListener('click', e => {
    const b = e.target.closest('button[data-c]'); if (!b || b.dataset.c === cat) return;
    cat = b.dataset.c; store.set('hangman-cat', cat);
    $('#cats').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    catHint();
    if (!over && guessed.size && stats.streak) { stats.streak = 0; store.set('hangman-stats', stats); drawStats('streak'); }
    newWord();
  });
  $('#hintBtn').addEventListener('click', hint);
  $('#skipBtn').addEventListener('click', skip);
  $('#nextBtn').addEventListener('click', newWord);

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .palette, .cli')) return;
    if (document.documentElement.classList.contains('cli-open')) return;
    if (e.key === 'Enter' && over) { e.preventDefault(); newWord(); return; }
    if (e.key === '?') { e.preventDefault(); hint(); return; }
    if (/^[a-zA-Z]$/.test(e.key)) {
      if (t && t.closest && t.closest('button') && e.key === ' ') return;
      e.preventDefault(); guess(e.key);
    }
  });

  catHint(); drawStats(); newWord();
  // test hook (only with #debug in the URL, so the answer is not one console line away)
  if (location.hash === '#debug') window.__hangman = { get: () => ({ term: cur.term, misses, over, guessed: [...guessed] }), count: ALL.length, cats: Object.fromEntries(Object.keys(WORDS).map(k => [k, WORDS[k].length])) };
})();
