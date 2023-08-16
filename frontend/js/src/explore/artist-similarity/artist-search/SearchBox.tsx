import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  faMagnifyingGlass,
  faMinus,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { throttle } from "lodash";
import SearchDropdown from "./SearchDropdown";
import artistLookup, { ArtistType } from "./artistLookup";

interface SearchBoxProps {
  currentsimilarArtistsLimit: number;
  onSimilarArtistsLimitChange: (similarArtistsLimit: number) => void;
  onArtistChange: (artist_mbid: string) => void;
}

function SearchBox({
  currentsimilarArtistsLimit,
  onSimilarArtistsLimitChange,
  onArtistChange,
}: SearchBoxProps) {
  // State to store the search results (list of artists)
  const [searchResults, setSearchResults] = React.useState<Array<ArtistType>>(
    []
  );
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  // State to toggle the dropdown menu for search
  const [openDropdown, setOpenDropdown] = useState(false);

  /* Below is the piece of the code with problem.
    *   My plan: 
    *       I decided to make the api call outside of this component in artistLookup, a bit different from SearchTrackorMBID.
    *       Thinking it would decrease the complexity of the code but I guess I added more unintentionally.
    *   Problem:
    *       Oftentimes the results presented in the dropdown would lag behind the search query e.g. Bruno Mars even though the api call
    *       was made correctly. I believe the problem is how React re-renders on state changes but I am very unsure. In this part I use 
    *       throttle in the artistLookup.
    * /
    
    /*
    // Lookup the artist based on the query
    const getArtists = async (): Promise<void> => {
        if(searchQuery.length && searchQuery.trim() !== ""){
            let results = await artistLookup(searchQuery);
            setSearchResults(results ?? []);
            //console.log(searchResults);
            // Open the dropdown if any results exist
            if(searchResults.length) {
                //console.log(searchResults);
                setOpenDropdown(true);
            }
        }
        else{
            setSearchResults([]);
        }
    };

    const handleQueryChange = (query: string) => {
        setSearchQuery(query);
    }

    useEffect(() => {
        getArtists();
    },[searchQuery]);
    */

  /**
   * Solution:
   *  I was able to look up an article for the problem, https://www.developerway.com/posts/debouncing-in-react
   *  The solution works as expected but I feel like it might be a bit hard to understand what's going on.
   */

  const getArtists = useCallback(async () => {
    if (searchQuery.length && searchQuery.trim().length) {
      const results = await artistLookup(searchQuery);
      setSearchResults(results);
      setOpenDropdown(true);
    }
  }, [searchQuery]);
  const getArtistsRef = useRef(getArtists);

  useEffect(() => {
    // Update the getArtists reference when searchQuery gets updated.
    getArtistsRef.current = getArtists;
  }, [getArtists, searchQuery]);

  // Create a throttled function using the current reference of getArtists
  const throttledGetArtists = useMemo(() => {
    return throttle(
      () => {
        getArtistsRef.current?.();
      },
      800,
      { leading: false, trailing: true }
    );
  }, []);

  // Lookup the artist based on the query
  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    throttledGetArtists();
  };

  const increment = () => {
    onSimilarArtistsLimitChange(currentsimilarArtistsLimit + 1);
  };
  const decrement = () => {
    onSimilarArtistsLimitChange(currentsimilarArtistsLimit - 1);
  };
  return (
    <form className="user-inputs-container" autoComplete="off">
      <div
        className="artist-input-container"
        onFocus={() => searchResults.length && setOpenDropdown(true)}
        onBlur={() => setTimeout(() => setOpenDropdown(false), 100)}
      >
        <div className="searchbox-container">
          <input
            id="searchbox-artist-name"
            type="search"
            name="artist_mbid"
            placeholder="Artist name"
            onChange={(e) => handleQueryChange(e.target.value)}
            value={searchQuery}
          />
          <button id="searchbox-icon" type="button">
            <FontAwesomeIcon icon={faMagnifyingGlass} color="white" />
          </button>
        </div>
        <div className="search-dropdown-container">
          {openDropdown && (
            <SearchDropdown
              searchResults={searchResults}
              onArtistChange={onArtistChange}
              onDropdownChange={setOpenDropdown}
              id="search-dropdown"
            />
          )}
        </div>
      </div>
      <div className="graph-size-input-container">
        <label htmlFor="graph-size-input-number" id="graph-size-input-label">
          Web size:
        </label>
        <button
          id="graph-size-input-icon-minus"
          type="button"
          onClick={decrement}
        >
          <FontAwesomeIcon icon={faMinus} color="white" />
        </button>
        <input
          id="graph-size-input-number"
          type="number"
          name="similarArtistsLimit"
          placeholder="Graph size"
          size={2}
          onChange={(e) => onSimilarArtistsLimitChange(e.target.valueAsNumber)}
          value={currentsimilarArtistsLimit}
          required
        />
        <span id="graph-size-input-warning" className="validity" />
        <button
          id="graph-size-input-icon-plus"
          type="button"
          onClick={increment}
        >
          <FontAwesomeIcon icon={faPlus} color="white" />
        </button>
      </div>
    </form>
  );
}
export default SearchBox;
