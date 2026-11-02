# Applied to the verifier bb writes (circuits/build.sh). Word boundaries: [[:<:]] [[:>:]] on macOS sed.
s/[[:<:]]BaseZKHonkVerifier[[:>:]]/ZkflashTraceBase/g
s/[[:<:]]HonkVerifier[[:>:]]/ZkflashPathCheck/g
s/[[:<:]]HonkVerificationKey[[:>:]]/ZkflashTraceKey/g
s/[[:<:]]Honk[[:>:]]/ZkflashTraceShape/g
s/[[:<:]]Errors[[:>:]]/ZkflashTraceErrors/g
s/[[:<:]]FrLib[[:>:]]/ZkflashFieldSteps/g
s/[[:<:]]ZKTranscriptLib[[:>:]]/ZkflashSpongeTape/g
s/[[:<:]]ZKTranscript[[:>:]]/ZkflashSpongeState/g
s/[[:<:]]RelationsLib[[:>:]]/ZkflashGateChecks/g
s/[[:<:]]CommitmentSchemeLib[[:>:]]/ZkflashFoldMath/g
s/[[:<:]]IVerifier[[:>:]]/IZkflashPathCheck/g
