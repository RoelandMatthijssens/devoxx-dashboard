const PIXELS_PER_MINUTE = 2;
const COMPACT_TALK_THRESHOLD_MINUTES = 60;
const BRUSSELS_UTC_OFFSET_MINUTES = 120; // Devoxx Belgium takes place in October (UTC+2).

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const state = {
  activeDayIndex: 0,
  videosOnly: false,
  days: [],
  seenTalkIds: new Set(),
};

const elements = {
  app: document.querySelector("#app"),
  tabs: document.querySelector("#tabs"),
  search: document.querySelector("#search"),
  videoOnlyButton: document.querySelector("#videoOnly"),
  dialog: document.querySelector("#talkDialog"),
  modalTitle: document.querySelector("#modalTitle"),
  modalMeta: document.querySelector("#modalMeta"),
  modalDescription: document.querySelector("#modalDescription"),
  modalImage: document.querySelector("#modalImage"),
  modalActions: document.querySelector("#modalActions"),
};

function escapeHtml(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value ?? "").replace(/[&<>"']/g, (character) => characters[character]);
}

function minutesSinceMidnight(isoTimestamp) {
  const date = new Date(isoTimestamp);
  return date.getUTCHours() * 60 + date.getUTCMinutes() + BRUSSELS_UTC_OFFSET_MINUTES;
}

function durationInMinutes(slot) {
  return minutesSinceMidnight(slot.to) - minutesSinceMidnight(slot.from);
}

function extractYouTubeVideoId(url) {
  try {
    return new URL(url).searchParams.get("v") ?? "";
  } catch {
    return "";
  }
}

function speakerNames(talk) {
  return (talk?.speakers ?? []).map((speaker) => speaker.fullName).join(", ");
}

function loadSeenTalkIds() {
  const storageKey = document.body.dataset.storageKey;

  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeenTalkIds() {
  localStorage.setItem(
    document.body.dataset.storageKey,
    JSON.stringify([...state.seenTalkIds]),
  );
}

function toggleSeenTalk(talkId, button) {
  if (state.seenTalkIds.has(talkId)) {
    state.seenTalkIds.delete(talkId);
  } else {
    state.seenTalkIds.add(talkId);
  }

  saveSeenTalkIds();

  const isSeen = state.seenTalkIds.has(talkId);
  const label = isSeen ? "Mark as unseen" : "Mark as seen";

  button.closest(".event").classList.toggle("seen", isSeen);
  button.textContent = isSeen ? "✓" : "○";
  button.title = label;
  button.setAttribute("aria-label", label);
}

function teamRatingClass(rating) {
  if (rating >= 8) return "great";
  if (rating >= 7) return "good";
  return "";
}

function teamRatingColor(rating) {
  if (rating >= 8) return "#ffc94d";
  if (rating >= 7) return "#6ee7a8";
  return "#c8d1df";
}

function renderTeamRatingBadge(teamRating) {
  if (!teamRating) return "";

  const reviewLabel = teamRating.reviews === 1 ? "review" : "reviews";

  return `
    <span class="team-rating ${teamRatingClass(teamRating.rating)}">
      ★ ${teamRating.rating}/10 · ${teamRating.reviews} ${reviewLabel}
    </span>
  `;
}

function renderSeenButton(talkId, isSeen) {
  const label = isSeen ? "Mark as unseen" : "Mark as seen";

  return `
    <button
      class="seen-toggle"
      data-id="${escapeHtml(talkId)}"
      title="${label}"
      aria-label="${label}"
    >${isSeen ? "✓" : "○"}</button>
  `;
}

function eventClassNames(slot, isSeen) {
  if (!slot.talk) return "break";

  return [
    slot.talk.youtubeUrl ? "video" : "",
    isSeen ? "seen" : "",
    durationInMinutes(slot) < COMPACT_TALK_THRESHOLD_MINUTES ? "compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderEvent(slot, roomIndex, scheduleStart) {
  const talk = slot.talk;
  const talkId = talk ? String(talk.id) : "";
  const isSeen = Boolean(talkId && state.seenTalkIds.has(talkId));
  const top = (minutesSinceMidnight(slot.from) - scheduleStart) * PIXELS_PER_MINUTE;
  const height = Math.max(28, durationInMinutes(slot) * PIXELS_PER_MINUTE - 4);
  const title = talk?.title || slot.kind;
  const metadata = speakerNames(talk) || slot.kind;
  const track = talk?.track?.name ? ` · ${escapeHtml(talk.track.name)}` : "";
  const videoMarker = talk?.youtubeUrl ? '<span class="watch">▶ </span>' : "";
  const talkAttributes = talk
    ? `data-talk-id="${escapeHtml(talkId)}" title="Show talk details"`
    : "";

  return `
    <div
      class="event ${eventClassNames(slot, isSeen)}"
      style="top:${top}px;left:calc(${roomIndex} * var(--lane));height:${height}px"
      ${talkAttributes}
    >
      ${talk ? renderSeenButton(talkId, isSeen) : ""}
      <div class="title">${videoMarker}${escapeHtml(title)}</div>
      <div class="meta">${escapeHtml(metadata)}${track}</div>
      ${talk ? `
        <div class="popularity" title="Attendee favourites in the Devoxx schedule app">
          <span>♥ ${compactNumber.format(talk.totalFavourites || 0)}<span class="metric-label"> favourites</span></span>
        </div>
      ` : ""}
      ${renderTeamRatingBadge(talk?.teamRating)}
    </div>
  `;
}

function renderTimeTicks(scheduleStart, scheduleEnd) {
  const ticks = [];
  const firstTick = Math.ceil(scheduleStart / 30) * 30;

  for (let minute = firstTick; minute <= scheduleEnd; minute += 30) {
    const hours = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    const top = (minute - scheduleStart) * PIXELS_PER_MINUTE;

    ticks.push(`<div class="tick" style="top:${top}px">${hours}:${minutes}</div>`);
  }

  return ticks.join("");
}

function roomSortValue(room) {
  return Number(room.match(/\d+/)?.[0] ?? 999);
}

function getVisibleSlots(day) {
  const query = elements.search.value.toLowerCase().trim();

  return day.slots.filter((slot) => {
    const talk = slot.talk ?? {};
    const searchableText = [
      talk.title,
      speakerNames(talk),
      slot.room,
      talk.track?.name,
      slot.kind,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !query || searchableText.includes(query);
    const matchesVideoFilter = !state.videosOnly || talk.youtubeUrl;

    return matchesSearch && matchesVideoFilter;
  });
}

function renderTabs() {
  elements.tabs.innerHTML = state.days
    .map((day, index) => `
      <button class="${index === state.activeDayIndex ? "active" : ""}" data-day-index="${index}">
        ${escapeHtml(day.name)}
      </button>
    `)
    .join("");

  elements.tabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeDayIndex = Number(button.dataset.dayIndex);
      renderSchedule();
    });
  });
}

function renderSchedule() {
  renderTabs();

  const day = state.days[state.activeDayIndex];
  const visibleSlots = getVisibleSlots(day);
  const rooms = [...new Set(visibleSlots.map((slot) => slot.room))].sort(
    (left, right) => roomSortValue(left) - roomSortValue(right) || left.localeCompare(right),
  );
  const scheduleStart = Math.min(...day.slots.map((slot) => minutesSinceMidnight(slot.from)));
  const scheduleEnd = Math.max(...day.slots.map((slot) => minutesSinceMidnight(slot.to)));
  const scheduleHeight = (scheduleEnd - scheduleStart) * PIXELS_PER_MINUTE;
  const formattedDate = new Date(`${day.date}T12:00:00`).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const roomHeaders = rooms
    .map((room) => `<div class="room">${escapeHtml(room)}</div>`)
    .join("");
  const roomLanes = rooms
    .map((_, index) => `
      <div class="lane" style="left:calc(${index} * var(--lane));height:${scheduleHeight}px"></div>
    `)
    .join("");
  const events = visibleSlots
    .map((slot) => renderEvent(slot, rooms.indexOf(slot.room), scheduleStart))
    .join("");

  elements.app.innerHTML = `
    <section class="day active">
      <h2 class="day-head">
        ${escapeHtml(day.name)} · ${formattedDate}
        <small style="color:var(--muted);font-weight:400">— ${visibleSlots.length} items</small>
      </h2>
      <div class="scroller">
        <div class="board">
          <div class="rooms">${roomHeaders}</div>
          <div
            class="timegrid"
            style="height:${scheduleHeight}px;width:calc(${rooms.length} * var(--lane))"
          >
            ${roomLanes}
            ${renderTimeTicks(scheduleStart, scheduleEnd)}
            ${events}
          </div>
        </div>
      </div>
    </section>
  `;

  bindScheduleEvents(visibleSlots);
}

function bindScheduleEvents(visibleSlots) {
  document.querySelectorAll(".seen-toggle").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSeenTalk(button.dataset.id, button);
    });
  });

  document.querySelectorAll(".event[data-talk-id]").forEach((eventCard) => {
    eventCard.addEventListener("click", () => {
      const slot = visibleSlots.find(
        (candidate) => String(candidate.talk?.id) === eventCard.dataset.talkId,
      );

      if (slot) showTalkDialog(slot);
    });
  });
}

function renderTalkDescription(talk) {
  const favourites = Number(talk.totalFavourites || 0).toLocaleString();
  const popularity = `<p><strong>Devoxx popularity:</strong> ${favourites} attendee favourites</p>`;

  if (!talk.teamRating) {
    return popularity + (talk.description || "<p>No speaker description is available for this talk.</p>");
  }

  const rating = talk.teamRating;
  const reviewLabel = rating.reviews === 1 ? "review" : "reviews";
  const teamRating = `
    <p>
      <strong style="color:${teamRatingColor(rating.rating)}">Team rating: ${rating.rating}/10</strong>
      · ${rating.reviews} ${reviewLabel}
    </p>
  `;

  return popularity + teamRating + (talk.description || "<p>No speaker description is available for this talk.</p>");
}

function renderTalkActions(talk) {
  const youtubeAction = talk.youtubeUrl
    ? `<a class="youtube-button" href="${escapeHtml(talk.youtubeUrl)}" target="_blank" rel="noopener">▶ Watch on YouTube</a>`
    : "";
  const slidesAction = talk.slidesUrl
    ? `<a class="youtube-button" style="background:#3478d4" href="${escapeHtml(talk.slidesUrl)}" target="_blank" rel="noopener">▣ View slides</a>`
    : "";

  return youtubeAction + slidesAction;
}

function showTalkDialog(slot) {
  const talk = slot.talk;
  const youtubeVideoId = extractYouTubeVideoId(talk.youtubeUrl || "");

  elements.modalTitle.textContent = talk.title || "Talk";
  elements.modalMeta.textContent = [speakerNames(talk), talk.track?.name, slot.room]
    .filter(Boolean)
    .join(" · ");
  elements.modalDescription.innerHTML = renderTalkDescription(talk);
  elements.modalActions.innerHTML = renderTalkActions(talk);

  elements.modalImage.hidden = !youtubeVideoId;
  if (youtubeVideoId) {
    elements.modalImage.src = `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;
    elements.modalImage.alt = `YouTube thumbnail for ${talk.title}`;
  }

  elements.dialog.showModal();
}

function bindPageEvents() {
  elements.dialog.querySelector(".modal-close").addEventListener("click", () => {
    elements.dialog.close();
  });

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  elements.search.addEventListener("input", renderSchedule);

  elements.videoOnlyButton.addEventListener("click", () => {
    state.videosOnly = !state.videosOnly;
    elements.videoOnlyButton.classList.toggle("active", state.videosOnly);
    renderSchedule();
  });
}

async function loadSchedule() {
  const response = await fetch(document.body.dataset.scheduleUrl);

  if (!response.ok) {
    throw new Error(`Could not load schedule data (${response.status})`);
  }

  return response.json();
}

async function initialise() {
  state.days = await loadSchedule();
  state.seenTalkIds = loadSeenTalkIds();
  bindPageEvents();
  renderSchedule();
}

initialise().catch((error) => {
  console.error(error);
  elements.app.innerHTML = `
    <div class="empty">The schedule could not be loaded. Please refresh and try again.</div>
  `;
});
