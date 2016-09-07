TODO: screenshot here

## What is Blindpad?
Blindpad is an [open source](https://github.com/rmnoon/blindpad) collaborative text editor (like Google Docs or [CoderPad](https://coderpad.io)) with integrated semi-anonymizing voice chat intended to help reduce bias in technical communication.  In particular it can be used to extend the concept of “[blind auditions](https://en.wikipedia.org/wiki/Blind_audition)” to software programming and technical design interviews.  It is inspired by economists Claudia Goldin (Harvard) and Cecilia Rouse (Princeton) who concluded in [their 1997 paper](https://www.aeaweb.org/articles?id=10.1257/aer.90.4.715) that the introduction of blind auditions in professional orchestras is likely responsible for about one-third of the 250% increase in female membership between 1970 and the mid 1990s.

## How does it work?
### Semi-anonymizing voice chat
Before joining a pad the app has an simple (one-time) audio calibration screen where the user is asked to read a few phrases.  During this process Blindpad attempts to measure the [fundamental frequency](https://en.wikipedia.org/wiki/Fundamental_frequency) of the user’s voice.  With this information Blindpad can perform a slight pitch-shift to an ambiguous frequency in the range where many male and female voices overlap.  This can help reduce bias in an interview setting (potentially in both directions) although [studies have shown](http://www.ncbi.nlm.nih.gov/pubmed/22080221) that pitch is not the only factor that human brains use to classify the gender of a speaker.

### Multi-way blind
All participants in a pad are anonymized: usernames are randomly generated pseudonyms and no account sign-up is necessary.

### Peer-to-peer and ephemeral
Blindpad users connect directly to each other using peer-to-peer technology (via the WebRTC API).  This makes Blindpad fairly inexpensive to host (and thus free to use) and guarantees no intermediary exists that needs to know a user’s real identity or contact information.

### Reducing “stereotype threat”
The typical user flow avoids [stereotype threat](https://en.wikipedia.org/wiki/Stereotype_threat) as much as possible by removing the focus from the user’s identity and placing it on the workspace.  Besides the name, the core app doesn’t provide any indication of a special purpose beyond similar text editors.

### No special configuration
Applicant Tracking Systems or recruiting coordinators need only decide on a URL to share with with all parties before an interview.


## How can I use Blindpad?
A public version of Blindpad is hosted at [rmnoon.github.io/blindpad](https://rmnoon.github.io/blindpad).  Blindpad can be hosted on your own servers quite easily: you only need to serve the static content and host a small (~100 line) NodeJS signaler (used for peer discovery).

## What’s the long-term goal of the project?
The overarching goal of the project is to build a community capable of producing, hosting, and maintaining excellent free tooling that reduces bias in evaluation and communication.  This is a really hard problem and while a perfect solution might not be possible incremental progress is straightforward.

An important next step would be to produce (or lobby for) anonymizing plugins for popular Applicant Tracking Systems (like [Greenhouse](https://www.greenhouse.io/), [Lever](http://www.lever.co/), [Jobvite](http://www.jobvite.com/), and [Taleo](http://www.oracle.com/us/products/applications/taleo/enterprise/overview/index.html)).  With sufficient resources we could also start to produce an open-source ATS designed from the ground up to anonymize certain steps of the hiring process.

## How can I contribute to the project?
If you’d like to support the project financially you can TODO.  Donations will be used to upgrade the public hosted version of Blindpad and to fund future development.

If you’re inclined to contribute creatively (with code or design help) feel free to check out the repository, read over the project’s roadmap, and/or submit a pull request.

Lastly: if you have any ideas or feature requests on how to make the app more successful feel free to [open an issue](https://github.com/rmnoon/blindpad/issues/new) on Github.

## What should I do if I have a problem or run into a bug?
For all problems please [open an issue](https://github.com/rmnoon/blindpad/issues/new) on Github.  If possible please try to include simple steps to reproduce the problem.

## Who developed Blindpad?
Blindpad was developed by [Ryan Noon](http://rmnoon.github.io).  It leverages many other open source projects, including Typescript, Angular2, and libraries by [@mikolalysenko](https://github.com/mikolalysenko) and [@nkohari](https://github.com/nkohari).  See comments in the code for full attribution.  Blindpad is free software under the Apache License.

## Setting up the code
```bash
# clone the repo
git clone git@github.com:rmnoon/blindpad.git

# install dependencies
npm install
```
There's an npm script for all of the common operations.
```bash
# start a local dev server for the app (using the public signaler by default)
npm run dev-app

# do a development build of the app and signaler
npm run build

# do a production build of the app and signaler
npm run prod

# run available unit tests (focused mostly on audio processing)
npm run test
```

See `Protocol.ts` for configuring your installation: it holds all of the options you'll need to setup a signaler and point a frontend at it.  If anything isn't clear please file an issue.