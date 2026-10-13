# V5 visual asset provenance

The V5 art direction uses external visual material only where it materially improves realism. Code is used for layout, motion, camera behavior and interaction—not to imitate astrophotography.

## NASA / Webb nebula layer

- Asset: **Pillars of Creation (NIRCam and MIRI Composite Image)**
- Source: https://science.nasa.gov/asset/webb/pillars-of-creation-nircam-and-miri-composite-image/
- Direct display asset used by the site: `assets.science.nasa.gov/.../STScI-01GK2KMYS6HADS6ND8NRHG53RP.png`
- Credit: **NASA, ESA, CSA, STScI**; Image Processing: Joseph DePasquale (STScI), Alyssa Pagan (STScI), Anton Koekemoer (STScI)
- Use: fixed deep-space / nebula art layer with dark cinematic grading.

## NASA / Webb observation window

- Asset: **“Cosmic Cliffs” in the Carina Nebula (NIRCam Image)**
- Source: https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-image/
- Object: **Carina Nebula, NGC 3324**
- Credit: **NASA, ESA, CSA, STScI**
- Use: large photographic observation interlude between the project constellation and the flight log. The image is cropped and graded by the interface, but not generated or repainted.

## NASA/JPL Jupiter texture

- Source: https://science.nasa.gov/3d-resources/jupiter/
- Texture: Voyager-derived Jupiter map from JPL/Caltech generated planetary maps.
- Credit: **JPL & Caltech**
- Use: texture map on the large WebGL planetary sphere with a separate subtle atmosphere shell.

## NASA/JPL Mars texture

- Source: https://science.nasa.gov/3d-resources/mars/
- Texture: Viking imagery processed at USGS from JPL/Caltech generated planetary maps.
- Credit: **NASA / Jet Propulsion Laboratory & Caltech**
- Use: texture map on the secondary WebGL planetary sphere with a separate subtle atmosphere shell.

## NASA Deep Space 1 spacecraft

- Source: NASA Science 3D resource for **Deep Space 1**
- Asset type: GLB spacecraft model loaded directly into the React Three Fiber scene.
- Use: restrained foreground/mid-ground spacecraft pass tied to scroll progression. It is deliberately secondary to the portfolio content rather than used as a hero gimmick.

## Usage notes

NASA imagery/media is used as sourced visual material without implying NASA endorsement. The site keeps source credits visible in its footer and this manifest. Before production release, any additional third-party model, HDRI, texture or audio asset must be added here with its license and source URL.

## Approved future asset pools

- NASA 3D Resources: https://www.nasa.gov/3d-resources/
- NASA Science 3D Resources: https://science.nasa.gov/3d-resources/
- Poly Haven (CC0): https://polyhaven.com/

The design intentionally avoids copyrighted Marvel logos, characters, screenshots, music or proprietary Guardians of the Galaxy artwork. The film is treated only as a high-level emotional reference: cosmic adventure, retro-futurist instrumentation, saturated nebula color and playful mission energy.


## NASA / Webb Cartwheel Galaxy finale

- Asset: **Cartwheel Galaxy (NIRCam and MIRI Composite Image)**
- Source: https://science.nasa.gov/asset/webb/cartwheel-galaxy-nircam-and-miri-composite-image/
- Credit: **NASA, ESA, CSA, STScI, Webb ERO Production Team**
- Use: final transmission / communications chapter.
- The shipped URL requests a right-sized derivative from NASA's dynamic image service rather than the 30 MB full-resolution PNG.


## NASA Cassini Assembly 3D flyby

- Asset: **Cassini Assembly.glb**
- Source page: https://science.nasa.gov/3d-resources/cassini-assembly/
- Direct GLB: https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/cassini-assembly/Cassini%20Assembly.glb
- Credit: **NASA/JPL/Solar System Simulator**
- Use: short hero-to-systems flyby only.
- The model is normalized at runtime from its bounding box so scene choreography is not coupled to arbitrary authoring units.
- NASA notes that the downloadable assembly includes the orbiter from CAD models and does not show the thermal blanketing that covered much of the central structure.
