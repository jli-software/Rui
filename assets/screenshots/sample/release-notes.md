# Release notes

Every release ships the same three Windows artefacts and one Linux tarball, so
a link that worked last month still works today. The names never carry the
version number — that lives in the tag and on the release page, where people
actually read it.

## What goes into a release

A release is an entry in a list somebody scrolls past, not a changelog. Two or
three sentences on what changed and why it matters, written for the person
deciding whether to update. The detail belongs in the commit history, which is
one click away and does not have to be short.

## Checklist before tagging

1. Bump the version in all four places, or the built binary reports the wrong
   one at runtime and nobody notices until a bug report arrives.
2. Write the changelog entry first. If it is hard to write, the release is
   probably two releases.
3. Push the annotated tag last. The build starts from the tag, so anything not
   committed simply is not in it.

Windows is built natively rather than cross-compiled. The toolchain difference
is not cosmetic: a binary linked against the wrong runtime starts, shows an
error page and looks like a broken application rather than a broken build.
