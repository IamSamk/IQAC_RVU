import type { Flashcard, KGEdge, KGNode, KnowledgeGraph, QuizQuestion } from "@/types";

const card = (front: string, back: string): Flashcard => ({ front, back });
const ask = (question: string, options: string[], answerIndex: number): QuizQuestion => ({
  question,
  options,
  answer: options[answerIndex],
});

type NodeSeed = Omit<KGNode, "kind" | "weak" | "when"> & { day: number; weak?: boolean };
const chunk = ({ day, weak, ...seed }: NodeSeed): KGNode => ({ ...seed, kind: "chunk", when: `Day ${day}`, weak: weak ?? false });

const nodes: KGNode[] = [
  chunk({
    id: "cs-1-1",
    course_code: "CS304",
    unit: 1,
    chunk: 1,
    day: 1,
    title: "Pinhole camera and perspective projection",
    notes_md:
      "A pinhole camera maps a scene point (X, Y, Z) to the image point x = fX/Z, y = fY/Z. Image size falls as depth grows, which is why parallel lines appear to converge.",
    applied_example: "The focal length in this model is the same quantity DES201 uses to reason about field of view.",
    flashcards: [
      card("What is the image x-coordinate in a pinhole camera?", "x = fX / Z"),
      card("What happens to image size when depth doubles?", "It halves."),
    ],
    quiz: [
      ask("With f = 50 mm, X = 2 m and Z = 10 m, what is x?", ["10 mm", "25 mm", "4 mm", "100 mm"], 0),
      ask("Perspective projection does not preserve:", ["Straight lines", "Lengths", "Collinearity", "Point incidence"], 1),
      ask("Moving an object farther away makes its image:", ["Larger", "Smaller", "Unchanged", "Inverted twice"], 1),
    ],
  }),
  chunk({
    id: "cs-1-2",
    course_code: "CS304",
    unit: 1,
    chunk: 2,
    day: 3,
    title: "Aperture, f-stop and circle of confusion",
    notes_md:
      "The f-number is N = f/D. A point out of focus images to a blur disc called the circle of confusion. The disc grows with aperture diameter, so stopping down extends depth of field.",
    applied_example: "DES201 Unit 2 Chunk 1 uses the same relation to choose f/1.8 for portraits and f/11 for landscapes.",
    flashcards: [
      card("Define the f-number.", "N = f / D, focal length over aperture diameter."),
      card("What does a smaller aperture do to the blur disc?", "It shrinks it, which increases depth of field."),
    ],
    quiz: [
      ask("A 50 mm lens with a 25 mm aperture has what f-number?", ["f/1.4", "f/2", "f/4", "f/25"], 1),
      ask("Which setting gives the deepest depth of field?", ["f/1.8", "f/2.8", "f/5.6", "f/16"], 3),
      ask("The circle of confusion describes:", ["Lens colour error", "Blur from a defocused point", "Sensor noise", "Motion blur"], 1),
    ],
  }),
  chunk({
    id: "cs-1-3",
    course_code: "CS304",
    unit: 1,
    chunk: 3,
    day: 5,
    title: "Exposure, sensor noise and radiometric calibration",
    weak: true,
    weak_reason: "Lost 2 of 5 marks on IA-1 Q2b",
    notes_md:
      "Image irradiance falls as 1/N². Shot noise grows with the square root of the signal, while gain amplifies signal and noise together. Radiometric calibration recovers the mapping from pixel values to scene irradiance.",
    applied_example: "The ISO setting in DES201 Unit 1 Chunk 3 is the sensor gain modelled here, which is why high ISO images look noisier.",
    flashcards: [
      card("How does shot noise scale with signal?", "With the square root of the signal."),
      card("What does radiometric calibration recover?", "The mapping from pixel value to scene irradiance."),
    ],
    quiz: [
      ask("Going from f/2 to f/4 changes irradiance by a factor of:", ["1/2", "1/4", "2", "4"], 1),
      ask("Raising sensor gain mainly:", ["Removes noise", "Amplifies signal and noise", "Changes focal length", "Reduces blur"], 1),
      ask("If the signal grows 4 times, shot noise grows:", ["2 times", "4 times", "8 times", "16 times"], 0),
    ],
  }),
  chunk({
    id: "cs-2-1",
    course_code: "CS304",
    unit: 2,
    chunk: 1,
    day: 8,
    title: "Camera calibration: intrinsics and extrinsics",
    weak: true,
    weak_reason: "Lost 1 of 5 marks on IA-1 Q2a",
    notes_md:
      "The intrinsic matrix K holds the focal lengths in pixels, the principal point and skew. Extrinsics R and t place the camera in the world. Checkerboard calibration estimates both by minimising reprojection error.",
    applied_example: "Focal length in pixels links to the lens focal length covered in DES201 Unit 1 Chunk 2.",
    flashcards: [
      card("What does the intrinsic matrix contain?", "Focal lengths in pixels, principal point and skew."),
      card("What does calibration minimise?", "Reprojection error."),
    ],
    quiz: [
      ask("Extrinsic parameters describe:", ["Lens distortion", "Camera pose", "Pixel size", "Sensor noise"], 1),
      ask("The principal point belongs to:", ["Extrinsics", "Intrinsics", "Noise model", "Exposure"], 1),
      ask("A common calibration target is a:", ["Checkerboard", "Grey wall", "Colour wheel", "Mirror"], 0),
    ],
  }),
  chunk({
    id: "cs-2-2",
    course_code: "CS304",
    unit: 2,
    chunk: 2,
    day: 10,
    title: "Image filtering and edge detection",
    notes_md:
      "Convolution with a Gaussian smooths noise. Sobel kernels estimate image gradients. Canny combines smoothing, gradient estimation, non-maximum suppression and hysteresis thresholding.",
    applied_example: "Filtering suppresses the high-ISO noise described in DES201 Unit 2 Chunk 3, at the cost of fine detail.",
    flashcards: [
      card("What does a Sobel kernel estimate?", "The image gradient along one axis."),
      card("Why use non-maximum suppression in Canny?", "It thins edges to single-pixel width."),
    ],
    quiz: [
      ask("A Gaussian filter is mainly used to:", ["Sharpen", "Smooth", "Threshold", "Rotate"], 1),
      ask("Which is the final Canny stage?", ["Smoothing", "Gradient estimation", "Hysteresis thresholding", "Non-maximum suppression"], 2),
      ask("Median filters work especially well on:", ["Salt-and-pepper noise", "Lens flare", "Motion blur", "Vignetting"], 0),
    ],
  }),
  chunk({
    id: "cs-2-3",
    course_code: "CS304",
    unit: 2,
    chunk: 3,
    day: 12,
    title: "Depth from defocus and the thin-lens model",
    notes_md:
      "The thin-lens equation is 1/f = 1/u + 1/v. Points away from the focus plane blur in proportion to aperture diameter and defocus, so comparing blur between images gives an estimate of depth.",
    applied_example: "A wide aperture from DES201 Unit 2 Chunk 1 produces stronger blur, which makes the depth cue easier to measure.",
    flashcards: [
      card("State the thin-lens equation.", "1/f = 1/u + 1/v"),
      card("What cue does depth from defocus use?", "How blur varies with distance from the focus plane."),
    ],
    quiz: [
      ask("With f = 50 mm and u = 100 mm, what is v?", ["50 mm", "100 mm", "150 mm", "200 mm"], 1),
      ask("A wider aperture makes defocus blur:", ["Weaker", "Stronger", "Disappear", "Independent of depth"], 1),
      ask("A point on the focus plane images as:", ["A large disc", "A sharp point", "A line", "Nothing"], 1),
    ],
  }),
  chunk({
    id: "des-1-1",
    course_code: "DES201",
    unit: 1,
    chunk: 1,
    day: 1,
    title: "Light, colour temperature and white balance",
    notes_md:
      "Colour temperature describes the colour of a light source in kelvin: tungsten is near 3200 K and daylight near 5500 K. White balance neutralises the colour cast of the source.",
    applied_example: "White balance is a per-channel gain, which is a simple case of the sensor gain in CS304 Unit 1 Chunk 3.",
    flashcards: [
      card("Roughly what is the colour temperature of daylight?", "About 5500 K."),
      card("What does white balance correct?", "The colour cast from the light source."),
    ],
    quiz: [
      ask("Tungsten light looks, relative to daylight:", ["Warmer", "Cooler", "Identical", "Green"], 0),
      ask("Colour temperature is measured in:", ["Lumens", "Kelvin", "Stops", "Watts"], 1),
      ask("Shooting tungsten-lit scenes with a daylight white balance looks:", ["Blue", "Orange", "Green", "Neutral"], 1),
    ],
  }),
  chunk({
    id: "des-1-2",
    course_code: "DES201",
    unit: 1,
    chunk: 2,
    day: 2,
    title: "Focal length and field of view",
    notes_md:
      "Field of view is 2·atan(d / 2f) for sensor width d. Long lenses narrow the view and magnify distant subjects, while wide lenses take in more of the scene.",
    applied_example: "This focal length is the f in the pinhole model of CS304 Unit 1 Chunk 1.",
    flashcards: [
      card("What happens to field of view as focal length grows?", "It narrows."),
      card("Give the field of view formula.", "2·atan(d / 2f)"),
    ],
    quiz: [
      ask("Which lens has the widest view on the same sensor?", ["24 mm", "50 mm", "85 mm", "200 mm"], 0),
      ask("Doubling focal length makes a distant subject appear:", ["Half as large", "Twice as large", "Unchanged", "Four times as large"], 1),
      ask("Field of view depends on focal length and:", ["ISO", "Sensor size", "Shutter speed", "White balance"], 1),
    ],
  }),
  chunk({
    id: "des-1-3",
    course_code: "DES201",
    unit: 1,
    chunk: 3,
    day: 4,
    title: "Exposure triangle: aperture, shutter and ISO",
    notes_md:
      "Exposure depends on aperture, shutter speed and ISO. One stop doubles or halves the light. Trading between them keeps exposure constant while changing depth of field, motion blur or noise.",
    applied_example: "CS304 Unit 1 Chunk 3 explains why each ISO stop raises noise: it is gain applied to the sensor signal.",
    flashcards: [
      card("How much light does one stop represent?", "Twice or half as much."),
      card("What does raising ISO cost you?", "More visible noise."),
    ],
    quiz: [
      ask("Going from 1/125 s to 1/60 s is about:", ["One stop more light", "One stop less light", "Two stops more", "No change"], 0),
      ask("Going from ISO 100 to ISO 400 gains:", ["1 stop", "2 stops", "3 stops", "4 stops"], 1),
      ask("Which setting most directly controls motion blur?", ["Aperture", "ISO", "Shutter speed", "White balance"], 2),
    ],
  }),
  chunk({
    id: "des-2-1",
    course_code: "DES201",
    unit: 2,
    chunk: 1,
    day: 6,
    title: "Aperture control and depth of field",
    notes_md:
      "A wide aperture such as f/1.8 isolates a subject with shallow depth of field. A narrow aperture such as f/11 keeps a scene sharp from front to back but admits less light.",
    applied_example: "The blur you see is the circle of confusion from CS304 Unit 1 Chunk 2.",
    flashcards: [
      card("Which aperture suits an isolated portrait?", "A wide one, such as f/1.8."),
      card("What is the trade-off of f/11?", "More depth of field but less light."),
    ],
    quiz: [
      ask("Which gives the shallowest depth of field?", ["f/1.8", "f/5.6", "f/11", "f/22"], 0),
      ask("Going from f/2.8 to f/5.6 admits:", ["Twice the light", "Half the light", "A quarter of the light", "The same light"], 2),
      ask("A landscape needing front-to-back sharpness suits:", ["f/1.4", "f/2", "f/11", "f/2.8"], 2),
    ],
  }),
  chunk({
    id: "des-2-2",
    course_code: "DES201",
    unit: 2,
    chunk: 2,
    day: 8,
    title: "Studio lighting and the inverse square law",
    notes_md:
      "Light intensity falls with the square of distance. Doubling the distance from a source leaves a quarter of the light, which is a two-stop drop. Moving a light is a precise way to control exposure.",
    applied_example: "Controlled light gives the known input needed for the radiometric calibration in CS304 Unit 1 Chunk 3.",
    flashcards: [
      card("State the inverse square law.", "Intensity is proportional to 1 / distance²."),
      card("Doubling distance costs how many stops?", "Two stops."),
    ],
    quiz: [
      ask("Tripling the distance leaves what share of the light?", ["1/2", "1/3", "1/6", "1/9"], 3),
      ask("Halving the distance gains:", ["1 stop", "2 stops", "3 stops", "4 stops"], 1),
      ask("A large soft source gives shadows that are:", ["Harder", "Softer", "Coloured", "Absent"], 1),
    ],
  }),
  chunk({
    id: "des-2-3",
    course_code: "DES201",
    unit: 2,
    chunk: 3,
    day: 10,
    title: "Image noise and RAW workflow",
    notes_md:
      "RAW files keep linear sensor data at a higher bit depth, which leaves more room for exposure and white balance corrections. Denoising reduces high-ISO grain but can remove fine detail.",
    applied_example: "Denoising tools apply the smoothing filters from CS304 Unit 2 Chunk 2.",
    flashcards: [
      card("Why shoot RAW?", "It keeps linear data and more bit depth for later edits."),
      card("What is the risk of heavy denoising?", "Loss of fine detail."),
    ],
    quiz: [
      ask("Compared with JPEG, RAW keeps:", ["Less data", "More bit depth", "Fixed white balance", "Only 8 bits"], 1),
      ask("Noise is most visible in:", ["Bright highlights", "Dark shadows", "Sharp edges", "Lens flare"], 1),
      ask("A white balance change is best made on:", ["RAW", "A printed copy", "A screenshot", "A thumbnail"], 0),
    ],
  }),
  {
    id: "bridge-aperture",
    kind: "bridge",
    course_code: "BRIDGE",
    unit: 0,
    chunk: 0,
    title: "Aperture (f-stop) & Depth of Field / Circle of Confusion",
    weak: false,
    notes_md:
      "CS304 models blur as the circle of confusion, which grows with aperture diameter. DES201 applies the same fact to composition: wide apertures isolate subjects and narrow ones keep a scene sharp.",
    applied_example:
      "Take the same scene at f/1.8 and f/11. In DES201 terms the first isolates the subject. In CS304 terms its larger blur discs give a stronger depth-from-defocus cue.",
    flashcards: [
      card("What links f-stop to blur?", "Blur disc size scales with aperture diameter D = f / N."),
      card("Why do both courses care?", "One uses blur as a creative tool, the other as a measurable depth cue."),
    ],
    quiz: [
      ask("Stopping down from f/2 to f/8 makes the blur disc:", ["Larger", "Smaller", "Unchanged", "Coloured"], 1),
      ask("The photographer's shallow depth of field equals the vision engineer's:", ["Large circle of confusion away from focus", "Low sensor gain", "Short exposure", "Small field of view"], 0),
      ask("For depth from defocus you would prefer:", ["A wide aperture", "A pinhole", "High ISO", "Short focal length only"], 0),
    ],
  },
  {
    id: "bridge-exposure",
    kind: "bridge",
    course_code: "BRIDGE",
    unit: 0,
    chunk: 0,
    title: "Sensor ISO, Exposure & Image Noise",
    weak: false,
    notes_md:
      "DES201's exposure triangle treats ISO as a setting to trade against aperture and shutter. CS304 shows that it is sensor gain, which amplifies signal and noise alike, and that radiometric calibration can undo the mapping.",
    applied_example:
      "Shoot a grey card at ISO 100 and ISO 1600 with matched exposure. Both average to a similar value, but the ISO 1600 frame has more pixel variance, which is the noise CS304 measures.",
    flashcards: [
      card("What is ISO in sensor terms?", "Gain applied to the sensor signal."),
      card("Why does high ISO look noisy?", "Less light is captured and the gain amplifies its noise."),
    ],
    quiz: [
      ask("Matching exposure at a higher ISO means capturing:", ["More light", "Less light", "The same light", "Only blue light"], 1),
      ask("Grey-card frames at two ISOs differ most in:", ["Mean value", "Pixel variance", "Focal length", "Aspect ratio"], 1),
      ask("Raising gain improves signal-to-noise from shot noise:", ["Yes, always", "No, it amplifies both", "Only at f/16", "Only in RAW"], 1),
    ],
  },
];

const flow = (source: string, target: string): KGEdge => ({
  id: `${source}__${target}`,
  source,
  target,
  edge_type: "INTRA_COURSE_FLOW",
});

const bridge = (source: string, target: string, similarity_score: number, shared_concepts: string[]): KGEdge => ({
  id: `${source}__${target}`,
  source,
  target,
  edge_type: "CROSS_SUBJECT_BRIDGE",
  similarity_score,
  shared_concepts,
});

const apertureConcepts = ["Aperture", "f-stop", "Depth of Field", "Circle of Confusion"];
const exposureConcepts = ["Exposure", "ISO", "Sensor Noise", "Radiometric Calibration"];

const edges: KGEdge[] = [
  flow("cs-1-1", "cs-1-2"),
  flow("cs-1-2", "cs-1-3"),
  flow("cs-1-3", "cs-2-1"),
  flow("cs-2-1", "cs-2-2"),
  flow("cs-2-2", "cs-2-3"),
  flow("des-1-1", "des-1-2"),
  flow("des-1-2", "des-1-3"),
  flow("des-1-3", "des-2-1"),
  flow("des-2-1", "des-2-2"),
  flow("des-2-2", "des-2-3"),
  bridge("cs-1-2", "bridge-aperture", 0.91, apertureConcepts),
  bridge("bridge-aperture", "des-2-1", 0.91, apertureConcepts),
  bridge("cs-1-3", "bridge-exposure", 0.89, exposureConcepts),
  bridge("bridge-exposure", "des-1-3", 0.89, exposureConcepts),
];

export const fallbackGraph: KnowledgeGraph = { student_id: "demo-student-aarav", nodes, edges };
