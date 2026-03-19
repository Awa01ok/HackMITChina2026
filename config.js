function buildConfig(person) {
    const generatedChapters = (person.events || []).map(event => ({
        id: event.id,
        alignment: "right",
        title: event.title,
        description: event.description,
        image: event.image || "",
        location: {
            center: event.center,
            zoom: event.zoom,
            pitch: event.pitch,
            bearing: event.bearing
        },
        onChapterEnter: [],
        onChapterExit: []
    }));

    generatedChapters.push({
        id: 'overview-final',
        alignment: 'full',
        title: '',
        description: '',
        image: '',
        location: {
            center: generatedChapters.length > 0
                ? generatedChapters[generatedChapters.length - 1].location.center
                : [0, 20],
            zoom: 2,
            pitch: 0,
            bearing: 0
        },
        onChapterEnter: [],
        onChapterExit: [],
        isOverview: true
    });

    return {
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',

        showMarkers: true,
        markerColor: '#3FB1CE',

        inset: true,
        insetStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        insetPosition: 'bottom-right',
        insetZoom: 1,
        insetOptions: {
            markerColor: 'orange'
        },

        theme: 'dark',

        use3dTerrain: false,

        auto: false,

        title: 'WWII Biography Story Map',
        subtitle: `${person.name || ''} ${person.years ? '· ' + person.years : ''}`.trim(),
        byline: person.summary || '',
        footer: 'Created for HackMIT using the MapLibre Storytelling template.',

        chapters: generatedChapters
    };
}
