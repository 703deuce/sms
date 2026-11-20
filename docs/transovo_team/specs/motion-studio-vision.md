> **PM note (15 Nov 2026, after John's 12:53 AM ET decision, relayed by the CoS):** the product is now named **Motion Studio**. It is both the product being built and the long-term umbrella described below. **v1 = documentaries** (the first director), at `/app/motion-studio` / `/api/motion-studio/*`, distinct from the existing AI Studio (`/app/studio`). Where the text below says "Transovo Studio" or "Transovo AI Motion Studio", read **Motion Studio**. The rest of this file is the saved verbatim vision and is otherwise unchanged. Build spec: `transovo-studio-build.md`.

     1|I think you’ve just identified a much bigger opportunity for Transovo.
     2|
     3|You don’t need to build a documentary generator, then a separate explainer generator, then another tutorial generator. You could build one professional AI motion-graphics production engine, with specialized pipelines for different video types.
     4|
     5|And the reason this is exciting is exactly what you’re seeing in the Cinematic Skill renders: the graphics look like professionally designed video, not like stock footage with captions slapped on top.
     6|
     7|A documentary about GameStop, a software tutorial, an animated financial breakdown, and a product launch video could all share the same rendering foundation. What’s different is how the AI plans the story, uses the source material, and directs the visuals.
     8|
     9|1. Every major motion-graphics video category, ranked
    10|
    11|I’m ranking these by the estimated percentage of the final video that could be made up of motion graphics in a motion-design-focused production, not by popularity or market size.
    12|
    13|The percentages are illustrative creative ranges, not industry statistics. A given production can be much more or less animated.
    14|
    15|Motion graphics intensity
    16|
    17|Highest → lowest
    18|
    19|1. Kinetic typography videos
    20|
    21|95–100%
    22|
    23|Words, typography, synchronized visual effects
    24|
    25|2. Animated infographics
    26|
    27|90–100%
    28|
    29|Data, figures, icons and illustrated information
    30|
    31|3. Data visualization / chart stories
    32|
    33|85–100%
    34|
    35|Markets, trends, statistics and comparisons
    36|
    37|4. Abstract concept explainers
    38|
    39|85–100%
    40|
    41|Ideas visualized using shapes, symbols and metaphors
    42|
    43|5. Animated diagrams / process explainers
    44|
    45|85–100%
    46|
    47|Systems, workflows and mechanisms
    48|
    49|6. Motion-graphic commercials
    50|
    51|80–100%
    52|
    53|Product claims, icons, branded scenes
    54|
    55|7. 2D / 2.5D educational animations
    56|
    57|80–100%
    58|
    59|Science, history, economics and concepts
    60|
    61|8. Finance / investing explainers
    62|
    63|75–95%
    64|
    65|Charts, money flows, scenarios and timelines
    66|
    67|9. Science / engineering visualizations
    68|
    69|75–95%
    70|
    71|Networks, models, systems and simulations
    72|
    73|10. Animated maps / geography stories
    74|
    75|75–95%
    76|
    77|Map journeys, routes, locations and overlays
    78|
    79|11. SaaS / app explainer videos
    80|
    81|70–95%
    82|
    83|UI screens, mockups, animated interactions
    84|
    85|12. Whiteboard / illustrated explanations
    86|
    87|70–95%
    88|
    89|Drawn concepts, diagrams and labels
    90|
    91|13. Product launches / feature announcements
    92|
    93|65–90%
    94|
    95|Screens, headlines, product visuals and effects
    96|
    97|14. Business / startup pitch videos
    98|
    99|60–90%
   100|
   101|Market diagrams, metrics, comparisons
   102|
   103|15. Video essays / visual analysis
   104|
   105|55–85%
   106|
   107|Photos, evidence, diagrams and footage
   108|
   109|16. Economic / business case studies
   110|
   111|55–85%
   112|
   113|Financial data, organizations, animated context
   114|
   115|17. Historical / investigative documentaries
   116|
   117|40–80%
   118|
   119|Archival media, evidence boards, maps, interviews
   120|
   121|18. News explainers / current-affairs breakdowns
   122|
   123|40–80%
   124|
   125|Timelines, headlines, maps, footage
   126|
   127|19. Corporate training / onboarding videos
   128|
   129|40–75%
   130|
   131|Step diagrams, UI, annotations
   132|
   133|20. Animated social-media explainers
   134|
   135|40–75%
   136|
   137|Kinetic text, graphics, footage
   138|
   139|21. Software product demos
   140|
   141|35–70%
   142|
   143|Real screens, zooms, callouts and branded compositions
   144|
   145|22. Screen-recorded tutorials
   146|
   147|25–60%
   148|
   149|Loom capture, highlights, labels and UI walkthroughs
   150|
   151|23. Marketing / sales presentation videos
   152|
   153|25–60%
   154|
   155|Visual arguments, charts, testimonials
   156|
   157|24. Sports analysis / tactical breakdowns
   158|
   159|25–60%
   160|
   161|Player tracking, play diagrams, footage
   162|
   163|25. Real-estate / architectural presentations
   164|
   165|20–55%
   166|
   167|Property footage, maps, callouts and floor plans
   168|
   169|26. Music / pop-culture documentaries
   170|
   171|20–55%
   172|
   173|Interviews, performances, archival media and graphic sequences
   174|
   175|27. Talking-head educational videos
   176|
   177|15–50%
   178|
   179|Speaker footage enhanced by diagrams and graphics
   180|
   181|28. Podcast visual explainers / recaps
   182|
   183|10–40%
   184|
   185|Interview or audio-led footage with graphic inserts
   186|
   187|Show top 15
   188|
   189|The categories overlap deliberately. For example, a financial documentary can also be an economic case study, an explainer, and a video essay. That’s actually useful for your architecture because the same production capabilities serve multiple customer markets.
   190|
   191|Current motion-video products already demonstrate pieces of this overlap. For example, Idea to Motion⁠￼ describes transforming a raw software recording into branded animated screens with narration, while PuppyDog⁠￼ describes adding camera zooms, spotlights and callouts to actual SaaS footage. Idea to Motion +2
   192|
   193|These are examples of related workflows, not evidence that their output necessarily equals your Cinematic Skill renders.
   194|
   195|2. The five video types I find most promising for Transovo
   196|
   197|These aren’t necessarily the five most motion-heavy. They’re the five where I see a useful combination of professional output, people willing to pay, and reuse of what you’ve already built.
   198|
   199|1. SaaS product explainers and demos
   200|
   201|My first pick
   202|
   203|Typical motion-heavy treatment: 35–95%
   204|
   205|A software founder uploads screenshots, a Loom recording, or a website link. The AI creates a polished product demonstration with cinematic UI movements, captions, callouts and voiceover.
   206|
   207|Why I like it: Businesses have a direct reason to pay: product marketing, onboarding and conversion.
   208|
   209|2. Explainer and educational videos
   210|
   211|Typical motion-heavy treatment: 70–100%
   212|
   213|Give it a topic, lesson, script or research notes. It turns abstract ideas into animated diagrams, comparisons, processes and visual storytelling.
   214|
   215|Why: This uses the Cinematic Skill foundation almost directly, without needing much real-world footage.
   216|
   217|3. Cinematic documentaries and video essays
   218|
   219|Typical motion-heavy treatment: 40–85%
   220|
   221|Users supply an idea, interviews, images or footage. The system researches, writes, selects clips and creates polished graphics between real footage.
   222|
   223|Why: This showcases your whole production engine and the new frame-exact video handoffs.
   224|
   225|4. Software tutorials and training
   226|
   227|Typical motion-heavy treatment: 25–75%
   228|
   229|Upload Loom videos, screenshots, or recorded workflows. The AI identifies steps, removes pauses, highlights interface elements and adds animated instructions.
   230|
   231|Why: Very practical and a natural fit for Gemini visual analysis.
   232|
   233|5. Product launches and promotional videos
   234|
   235|Typical motion-heavy treatment: 65–100%
   236|
   237|The user provides a product description, logo, screenshots, brand colors and key selling points. The system builds a 30–90-second high-end promotional video.
   238|
   239|Why: Shorter videos, obvious commercial use, and easy to show before-and-after quality.
   240|
   241|I would actually test SaaS demos and explainer videos before trying to sell a completely autonomous 20-minute documentary product.
   242|
   243|Not because documentaries are less impressive. They’re fantastic demos of the technology.
   244|
   245|But a business owner who needs a 90-second product demo has a more immediate, measurable use case than a creator who wants a 20-minute documentary.
   246|
   247|And the tutorial category is already supported by tools like Camtasia SmartFocus and Screen Studio, which show that users value automatic camera movement, zooms and polished screen recordings. The opportunity is to combine that functionality with richer motion design and AI storytelling. TechSmith +1
   248|
   249|3. You don’t need 27 separate pipelines
   250|
   251|This is where I would structure the engineering carefully.
   252|
   253|I would build six directors on top of one shared production engine.
   254|
   255|Unified Transovo Production Engine
   256|
   257|Gemini visual analysis · script/audio alignment · media sourcing · Cinematic Skill · scene rendering · master timeline · audio mixing · QA
   258|
   259|Documentary
   260|
   261|Research + footage
   262|
   263|Explainer
   264|
   265|Concept + diagrams
   266|
   267|Product Demo
   268|
   269|Screens + benefits
   270|
   271|Tutorial
   272|
   273|Steps + accuracy
   274|
   275|Commercial
   276|
   277|Persuasion + branding
   278|
   279|Data Story
   280|
   281|Numbers + charts
   282|
   283|One editable video project
   284|
   285|Scenes · layers · real footage · motion graphics · narration · music · export
   286|
   287|What changes between the directors?
   288|
   289|Pipeline	What changes compared with Documentary
   290|Explainer	Less archival research, more diagrams, analogies and visual teaching
   291|Product Demo	Product-feature extraction, UI understanding, brand fidelity and conversion-focused script
   292|Tutorial	Strict step accuracy, cursor/click tracking, screen crop and instructional narration
   293|Commercial	Stronger opening hook, fast pacing, product benefits, CTA, brand constraints
   294|Data Story	Structured data ingestion, chart selection, numerical verification and animated transitions
   295|Documentary	Historical research, source provenance, interviews, archival media and narrative structure
   296|
   297|The common components remain the same. But some specialized modules are genuinely necessary.
   298|
   299|For example, a product demo needs to preserve real UI text, a data story must avoid distorting charts, and an instructional tutorial must not invent buttons that don’t exist.
   300|
   301|Those aren’t just different prompts. They’re different validation rules.
   302|
   303|4. Here’s how one engine could create three completely different videos
   304|
   305|Example A: SaaS product demo
   306|
   307|User says: “Make a 90-second product demo for my appointment-scheduling app.”
   308|
   309|User provides: Website URL, screenshots, or Loom recording.
   310|
   311|AI produces: A polished product showcase with animated UI, simulated camera movements, highlights, narration and a call to action.
   312|
   313|Specialized agent behavior: Analyzes the actual workflow, identifies the product’s strongest benefits, removes loading screens, and keeps the UI accurate.
   314|
   315|Example B: Educational explainer
   316|
   317|User says: “Explain how a neural network learns in five minutes.”
   318|
   319|User provides: Nothing, optionally a script or reading material.
   320|
   321|AI produces: Cinematic animated neurons, connections, mathematical concepts, diagrams, typography and narration.
   322|
   323|Specialized agent behavior: Builds an instructional sequence, uses analogies, and verifies the diagrams accurately represent the explanation.
   324|
   325|Example C: Documentary
   326|
   327|User says: “Make a 12-minute documentary about GameStop in 2021.”
   328|
   329|User provides: Nothing, optionally existing footage, photos or interviews.
   330|
   331|AI produces: A researched narrative with archival material, cinematic financial graphics, interviews and the camera transitions you just tested.
   332|
   333|Specialized agent behavior: Finds usable source media, validates claims, chooses footage, and blends live video with motion graphics.
   334|
   335|Same renderer. Same camera system. Same footage handoff. Same audio engine. Same editor.
   336|
   337|Different creative planning, component selection, and quality checks.
   338|
   339|5. How I would expose this in the UI
   340|
   341|I wouldn’t make 27 buttons on the home page.
   342|
   343|I’d show a small set of video types, and let the user choose one—or just describe what they want and let the AI determine the appropriate pipeline.
   344|
   345|Transovo Studio
   346|
   347|What would you like to create?
   348|
   349|Documentary
   350|
   351|Research, real footage, interviews and cinematic graphics
   352|
   353|Explainer
   354|
   355|Teach ideas with custom diagrams, animation and narration
   356|
   357|Product Demo
   358|
   359|Turn screenshots and recordings into a premium showcase
   360|
   361|Tutorial
   362|
   363|Transform Loom videos into polished step-by-step lessons
   364|
   365|Promo / Ad
   366|
   367|Build compelling branded videos and product announcements
   368|
   369|Data Story
   370|
   371|Animate financial data, metrics and visual comparisons
   372|
   373|Selected: Explainer
   374|
   375|Teach ideas with custom diagrams, animation and narration
   376|
   377|Explore this workflow Interactive product concept. Selecting a type updates the preview; the button requests a workflow design in this conversation.
   378|
   379|The six choices should correspond to six specialized production directors. Underneath them, the user could still select creative styles like cinematic, minimal, investigative, playful, financial, or educational.
   380|
   381|Video type and visual style are two separate things. A documentary could be minimalist. A product demo could be cinematic. You don’t want to lock one visual look to each pipeline.
   382|
   383|6. How I’d actually build this without creating six giant systems
   384|
   385|This part matters because it’s easy to accidentally create another enormous product backlog.
   386|
   387|I’d implement it in this order:
   388|
   389|01
   390|
   391|Shared cinematic engine
   392|
   393|Professional component system, layered scenes, backgrounds, camera movement, typography, scene code generation, narration synchronization, and frame-exact footage transitions.
   394|
   395|This is the foundation every product depends on.
   396|
   397|02
   398|
   399|Documentary + Explainer directors
   400|
   401|These share the most narrative and visual-planning logic. You already have documentary experiments to build from.
   402|
   403|03
   404|
   405|Product Demo + Tutorial directors
   406|
   407|Reuse Gemini visual analysis and the timeline, then add accurate screen-event recognition, cursor movements, zooms and UI-focused graphic components.
   408|
   409|04
   410|
   411|Commercial + Data Story directors
   412|
   413|Add conversion-focused writing and branded promotional components for commercials, plus structured data processing and correctness checks for charts.
   414|
   415|One thing I’d insist on: the motion framework must give the AI beautiful, polished components by default, without forcing it to use a fixed template.
   416|
   417|That was the lesson from your Cinematic Skill versus custom renderer tests.
   418|
   419|The engine gives you professional production quality. The AI gives you custom creative direction.
   420|
   421|7. What I think the business really is
   422|
   423|Before this, we were talking about building an AI documentary maker.
   424|
   425|Now I think the stronger concept is:
   426|
   427|Transovo AI Motion Studio — professional videos made from ideas, scripts, screenshots, recordings, data, and real footage.
   428|
   429|You could offer documentaries, explainers, tutorials, demos, ads, and animated data stories without building six separate editors.
   430|
   431|And importantly, the product doesn’t have to compete directly with expensive text-to-video generation. It can produce visually sophisticated videos using programmed motion design, real media, narration, and precise editing.
   432|
   433|The biggest risk is trying to launch every category before the shared engine consistently delivers professional output. I would prove that consistency with three very different test cases: a financial documentary, a software product demo, and a science explainer.
   434|
   435|If all three look as polished as the Cinematic Skill example—and the agents can build them without handholding—then you’ve demonstrated the foundation for a much larger product.
   436|
   437|My preference would be to keep documentaries as the flagship quality showcase, but build the architecture as a multi-format motion-video studio from day one. That way, adding another video type is mostly about creating a new director and specialized capabilities, not reinventing the production engine.